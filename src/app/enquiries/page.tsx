'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Upload,
  FileText,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Plus,
  Inbox,
  UserCheck,
  TrendingUp,
  Clock,
  ShieldAlert,
  Loader2,
  FileCode,
  FileCheck,
  Sparkles,
} from 'lucide-react'
import type { Enquiry, Status } from '@/types/enquiry'
import {
  formatCurrency,
  formatDate,
  getPriorityColor,
  getServiceLineColor,
  getStatusColor,
} from '@/lib/utils'

const DEMO_ENQUIRY_TEXT = `From: Marcus Vance
Company: Apex AI Solutions
Email: marcus@apexai.io
Received: Today
Message: Hi Sodio team, We are looking to build an AI-powered customer support chatbot integrated with our existing Knowledge Base (RAG architecture). We need custom fine-tuning and a React dashboard for live human agent handoff. Budget is around $75,000. We want to start ASAP.`

export default function EnquiryConsolePage() {
  const router = useRouter()

  // Data state
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [serviceLine, setServiceLine] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('receivedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Ingestion Modal State
  const [showIngestModal, setShowIngestModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'paste' | 'txt' | 'pdf'>('paste')
  const [pasteText, setPasteText] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isDemoLoaded, setIsDemoLoaded] = useState(false)

  // Live Batch Streaming State
  const [batchProgress, setBatchProgress] = useState<{
    running: boolean
    total: number
    processed: number
    successCount: number
    failCount: number
    message: string
  }>({ running: false, total: 0, processed: 0, successCount: 0, failCount: 0, message: '' })

  const [reExtractingId, setReExtractingId] = useState<string | null>(null)

  // Fetch enquiries list
  const loadEnquiries = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.append('search', search.trim())
      if (serviceLine !== 'all') params.append('serviceLine', serviceLine)
      if (priority !== 'all') params.append('priority', priority)
      if (status !== 'all') params.append('status', status)
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)

      const res = await fetch(`/api/enquiries?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch enquiries')
      const data = await res.json()
      setEnquiries(data)
    } catch (err: any) {
      setError(err?.message || 'Error loading enquiries')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEnquiries()
    }, 200)
    return () => clearTimeout(timer)
  }, [search, serviceLine, priority, status, sortBy, sortOrder])

  // Single Status Inline Transition Update
  const handleStatusChange = async (id: string, newStatus: Status) => {
    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      const updated = await res.json()
      setEnquiries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: updated.status, humanEditedFields: updated.humanEditedFields } : e))
      )
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`)
    }
  }

  // Re-extract single enquiry
  const handleReExtract = async (id: string) => {
    setReExtractingId(id)
    try {
      const res = await fetch(`/api/enquiries/${id}/re-extract`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Re-extraction failed')
      const updated = await res.json()
      setEnquiries((prev) => prev.map((e) => (e.id === id ? updated : e)))
    } catch (err: any) {
      alert(`Error re-extracting: ${err.message}`)
    } finally {
      setReExtractingId(null)
    }
  }

  // Delete enquiry
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this enquiry record?')) return
    try {
      const res = await fetch(`/api/enquiries/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setEnquiries((prev) => prev.filter((e) => e.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`)
    }
  }

  // Live Stream NDJSON Ingestion (Supports Paste, .txt file, .pdf file)
  const handleStreamIngest = async () => {
    setBatchProgress({
      running: true,
      total: 0,
      processed: 0,
      successCount: 0,
      failCount: 0,
      message: 'Initializing ingestion pipeline...',
    })

    try {
      const formData = new FormData()
      if (activeTab === 'paste') {
        if (!pasteText.trim()) throw new Error('Please enter raw text or load demo enquiry.')
        formData.append('rawText', pasteText)
      } else {
        if (!uploadFile) throw new Error(`Please select a .${activeTab} file to upload.`)
        formData.append('file', uploadFile)
      }

      const res = await fetch('/api/enquiries/batch', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Ingestion failed')
      }

      if (!res.body) throw new Error('ReadableStream not supported')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep last incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)

            if (event.type === 'batch_started') {
              setBatchProgress((prev) => ({
                ...prev,
                total: event.total,
                message: `Found ${event.total} enquiry block(s). Extracting with Claude...`,
              }))
            } else if (event.type === 'item_success') {
              setBatchProgress((prev) => ({
                ...prev,
                processed: prev.processed + 1,
                successCount: prev.successCount + 1,
                message: `Processed ${prev.processed + 1} of ${prev.total} items...`,
              }))
              // Dynamically insert or update row live in table!
              setEnquiries((prev) => [event.enquiry, ...prev.filter((e) => e.id !== event.enquiry.id)])
            } else if (event.type === 'item_failed') {
              setBatchProgress((prev) => ({
                ...prev,
                processed: prev.processed + 1,
                failCount: prev.failCount + 1,
                message: `Item #${event.index + 1} extraction failed. Inserted error record.`,
              }))
              setEnquiries((prev) => [event.enquiry, ...prev.filter((e) => e.id !== event.enquiry.id)])
            } else if (event.type === 'batch_completed') {
              setBatchProgress((prev) => ({
                ...prev,
                running: false,
                message: `Ingestion complete! Successfully triaged items.`,
              }))
            }
          } catch (pErr) {
            console.error('Parse chunk error:', pErr)
          }
        }
      }

      setShowIngestModal(false)
      setPasteText('')
      setUploadFile(null)
      setIsDemoLoaded(false)
      loadEnquiries()
    } catch (err: any) {
      alert(`Ingestion Error: ${err.message}`)
      setBatchProgress({ running: false, total: 0, processed: 0, successCount: 0, failCount: 0, message: '' })
    }
  }

  // Load Demo Enquiry Handler
  const handleLoadDemoEnquiry = () => {
    setActiveTab('paste')
    setPasteText(DEMO_ENQUIRY_TEXT)
    setIsDemoLoaded(true)
  }

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === enquiries.length && enquiries.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(enquiries.map((e) => e.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Stats calculation
  const totalCount = enquiries.length
  const highPriorityCount = enquiries.filter((e) => e.priority === 'high').length
  const genuineCount = enquiries.filter((e) => e.isGenuineEnquiry).length
  const totalPipelineUsd = enquiries.reduce((sum, e) => sum + (e.budgetNormalized || 0), 0)

  return (
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Enquiries</p>
            <h3 className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">High Priority</p>
            <h3 className="text-2xl font-bold text-rose-400 mt-1">{highPriorityCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Genuine Projects</p>
            <h3 className="text-2xl font-bold text-emerald-400 mt-1">{genuineCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Normalized Pipeline</p>
            <h3 className="text-2xl font-bold text-cyan-400 mt-1">{formatCurrency(totalPipelineUsd)}</h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>Project Triage Console</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingest raw text, .txt files, or .pdf files to extract structured fields and score priority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowIngestModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Ingest Enquiries (.txt / .pdf / Paste)</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="glass-panel p-4 rounded-xl border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search company, contact, text, summary..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Service Line Filter */}
          <div>
            <select
              value={serviceLine}
              onChange={(e) => setServiceLine(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Service Lines</option>
              <option value="ai">AI / ML</option>
              <option value="blockchain">Blockchain / Web3</option>
              <option value="web">Web App</option>
              <option value="mobile">Mobile App</option>
              <option value="game">Game Dev</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
        </div>

        {/* Sort Controls Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span>Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === 'receivedAt') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                else { setSortBy('receivedAt'); setSortOrder('desc'); }
              }}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                sortBy === 'receivedAt' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              Received Date {sortBy === 'receivedAt' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'priority') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                else { setSortBy('priority'); setSortOrder('desc'); }
              }}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                sortBy === 'priority' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              Priority {sortBy === 'priority' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>

            <button
              onClick={() => {
                if (sortBy === 'budgetNormalized') setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                else { setSortBy('budgetNormalized'); setSortOrder('desc'); }
              }}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                sortBy === 'budgetNormalized' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              Est. Budget USD {sortBy === 'budgetNormalized' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>

          <div>
            Showing <strong className="text-slate-200">{enquiries.length}</strong> enquiries
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="glass-panel rounded-2xl border-slate-800 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-400" />
            <p className="text-xs">Loading enquiry workspace...</p>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Inbox className="w-10 h-10 mx-auto text-slate-600" />
            <h4 className="text-sm font-semibold text-slate-300">No Enquiries Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No enquiry records match your current filters. Click "Ingest Enquiries" to paste text or upload .txt / .pdf files.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === enquiries.length && enquiries.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Company &amp; Sender</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Budget (Raw / Est USD)</th>
                  <th className="py-3 px-4">Timeline</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status Workflow</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {enquiries.map((item) => {
                  const priorityStyle = getPriorityColor(item.priority)
                  const serviceStyle = getServiceLineColor(item.serviceLine)
                  const statusStyle = getStatusColor(item.status)
                  const hasHumanEdits = item.humanEditedFields && item.humanEditedFields.length > 0
                  const isInjection = item.extractionNotes?.toLowerCase().includes('injection')
                  const isExtractionError = item.company === 'Extraction Error'

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectOne(item.id)}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Company & Sender */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs shrink-0 mt-0.5">
                            {(item.company || item.contactName || 'E').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5 font-semibold text-slate-100">
                              <Link
                                href={`/enquiries/${item.id}`}
                                className="hover:text-indigo-400 transition-colors flex items-center space-x-1"
                              >
                                <span>{item.company || item.contactName || 'Unnamed Enquiry'}</span>
                              </Link>
                              {hasHumanEdits && (
                                <span
                                  title={`Edited by human: ${item.humanEditedFields.join(', ')}`}
                                  className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-sm shadow-amber-400"
                                />
                              )}
                              {isInjection && (
                                <span
                                  title="Prompt Injection Attempt Detected"
                                  className="text-rose-400 flex items-center"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {isExtractionError && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  Extraction Failed
                                </span>
                              )}
                              {!item.isGenuineEnquiry && !isExtractionError && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  Non-Genuine
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] flex items-center space-x-2 mt-0.5">
                              <span>{item.contactEmail || 'No Email'}</span>
                              <span>&bull;</span>
                              <span>{formatDate(item.receivedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Service Line */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wide border ${serviceStyle.bg} ${serviceStyle.text} ${serviceStyle.border}`}
                        >
                          {item.serviceLine}
                        </span>
                      </td>

                      {/* Budget */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-medium text-slate-200">{item.budgetRaw}</div>
                          {item.budgetNormalized !== null && item.budgetNormalized !== undefined && (
                            <div className="text-[10px] text-cyan-400 mt-0.5 font-mono">
                              ≈ {formatCurrency(item.budgetNormalized)} USD
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Timeline */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span
                            className={
                              item.timeline?.toLowerCase().includes('asap')
                                ? 'text-rose-400 font-semibold'
                                : 'text-slate-300'
                            }
                          >
                            {item.timeline}
                          </span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${priorityStyle.badge}`}
                        >
                          {item.priority}
                        </span>
                      </td>

                      {/* Status Workflow Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as Status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none transition-colors ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          <option value="new" className="bg-slate-900 text-slate-200">New</option>
                          <option value="contacted" className="bg-slate-900 text-slate-200">Contacted</option>
                          <option value="qualified" className="bg-slate-900 text-slate-200">Qualified</option>
                          <option value="dropped" className="bg-slate-900 text-slate-200">Dropped</option>
                        </select>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/enquiries/${item.id}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="View Full Detail"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleReExtract(item.id)}
                            disabled={reExtractingId === item.id}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                            title="Re-run LLM Extraction"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${reExtractingId === item.id ? 'animate-spin' : ''}`}
                            />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Enquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-time Streaming Batch Overlay */}
      {batchProgress.running && (
        <div className="fixed bottom-6 right-6 z-50 glass-panel p-4 rounded-xl border-indigo-500/50 shadow-2xl max-w-md w-full animate-pulse-subtle">
          <div className="flex items-start space-x-3">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-100">Live Ingestion Streaming</h4>
              <p className="text-[11px] text-slate-300">{batchProgress.message}</p>
              {batchProgress.total > 0 && (
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (batchProgress.processed / batchProgress.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multiform Ingestion Modal (Tabs: Paste Text, Upload .txt, Upload .pdf + Demo Enquiry Button) */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-xl w-full border-slate-700 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                <span>Ingest Enquiry Input</span>
              </h3>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Input Options Tabs */}
            <div className="flex items-center space-x-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'paste' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setActiveTab('txt')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'txt' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload .txt File
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                  activeTab === 'pdf' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Upload .pdf File
              </button>
            </div>

            {/* Tab 1: Paste Text + Demo Enquiry Button */}
            {activeTab === 'paste' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Paste single or multi-block enquiry raw text below:</span>
                  <button
                    onClick={handleLoadDemoEnquiry}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Load Demo Enquiry</span>
                  </button>
                </div>

                <textarea
                  rows={7}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value)
                    if (isDemoLoaded) setIsDemoLoaded(false)
                  }}
                  placeholder="Paste raw text message from client here..."
                  className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />

                {isDemoLoaded && (
                  <p className="text-[11px] text-amber-400 font-medium flex items-center space-x-1">
                    <span>* Showing realistic demo enquiry format. Click "Ingest &amp; Process" or edit text above.</span>
                  </p>
                )}
              </div>
            )}

            {/* Tab 2 & 3: File Upload (.txt or .pdf) */}
            {(activeTab === 'txt' || activeTab === 'pdf') && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Upload a <code className="text-indigo-300">.{activeTab}</code> file containing raw enquiry blocks (separated by <code className="text-indigo-300">---</code>).
                  {activeTab === 'pdf' && ' Server-side pdf-parse will extract readable text layers.'}
                </p>

                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 text-center space-y-3 bg-slate-950/60 transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-indigo-400" />
                  <div>
                    <label className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                      <span>Select .{activeTab} file from disk</span>
                      <input
                        type="file"
                        accept={activeTab === 'pdf' ? '.pdf' : '.txt'}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setUploadFile(e.target.files[0])
                        }}
                      />
                    </label>
                    {uploadFile && (
                      <p className="text-xs text-emerald-400 font-mono mt-2 flex items-center justify-center space-x-1">
                        <FileCheck className="w-4 h-4" />
                        <span>Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end space-x-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowIngestModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={activeTab === 'paste' ? !pasteText.trim() : !uploadFile}
                onClick={handleStreamIngest}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20"
              >
                Ingest &amp; Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}