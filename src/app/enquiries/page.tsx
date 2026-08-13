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
  CheckSquare,
  Square,
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

  // Row Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Bulk Delete Modal states
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false)
  const [isDeletingSelected, setIsDeletingSelected] = useState(false)

  // Delete All Modal states
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [isDeletingAll, setIsDeletingAll] = useState(false)

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

  // Selection Helper Functions
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === enquiries.length && enquiries.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(enquiries.map((e) => e.id)))
    }
  }

  // Bulk Delete Selected Handler
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    setIsDeletingSelected(true)
    try {
      const idsArray = Array.from(selectedIds)
      const res = await fetch('/api/enquiries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsArray }),
      })

      if (!res.ok) throw new Error('Failed to delete selected enquiries')
      
      setEnquiries((prev) => prev.filter((e) => !selectedIds.has(e.id)))
      setSelectedIds(new Set())
      setShowDeleteSelectedModal(false)
    } catch (err: any) {
      alert(`Error deleting selected: ${err.message}`)
    } finally {
      setIsDeletingSelected(false)
    }
  }

  // Delete All Enquiries Handler
  const handleDeleteAll = async () => {
    if (deleteAllConfirmText.trim().toUpperCase() !== 'DELETE') return
    setIsDeletingAll(true)
    try {
      const res = await fetch('/api/enquiries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      })

      if (!res.ok) throw new Error('Failed to clear database')
      
      setEnquiries([])
      setSelectedIds(new Set())
      setShowDeleteAllModal(false)
      setDeleteAllConfirmText('')
    } catch (err: any) {
      alert(`Error wiping database: ${err.message}`)
    } finally {
      setIsDeletingAll(false)
    }
  }

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

  // Single Delete per-row icon
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

      const response = await fetch('/api/enquiries/batch', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok || !response.body) {
        throw new Error('Ingestion request failed on server.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)

            if (event.type === 'start') {
              setBatchProgress((prev) => ({
                ...prev,
                total: event.total,
                message: `Splitting text into ${event.total} enquiry blocks...`,
              }))
            } else if (event.type === 'progress') {
              setBatchProgress((prev) => ({
                ...prev,
                processed: event.processed,
                successCount: event.success ? prev.successCount + 1 : prev.successCount,
                failCount: event.success ? prev.failCount : prev.failCount + 1,
                message: event.item?.company ? `Ingested: ${event.item.company}` : `Processing ${event.processed}/${event.total}...`,
              }))

              if (event.item && event.success) {
                setEnquiries((prev) => [event.item, ...prev.filter((e) => e.id !== event.item.id)])
              }
            } else if (event.type === 'complete') {
              setBatchProgress((prev) => ({
                ...prev,
                running: false,
                message: `Completed processing ${event.processed} items (${event.successful} successful, ${event.failed} failed).`,
              }))
              loadEnquiries()
            }
          } catch (e) {
            console.error('Error parsing NDJSON line:', e)
          }
        }
      }

      setShowIngestModal(false)
      setPasteText('')
      setUploadFile(null)
      setIsDemoLoaded(false)
    } catch (err: any) {
      alert(`Ingestion Error: ${err.message}`)
      setBatchProgress((prev) => ({ ...prev, running: false, message: `Error: ${err.message}` }))
    }
  }

  // Load Demo Text helper
  const handleLoadDemo = () => {
    setActiveTab('paste')
    setPasteText(DEMO_ENQUIRY_TEXT)
    setIsDemoLoaded(true)
  }

  // Computed summary counts
  const totalCount = enquiries.length
  const newCount = enquiries.filter((e) => e.status === 'new').length
  const highPriorityCount = enquiries.filter((e) => e.priority === 'high').length
  const totalBudgetUSD = enquiries.reduce((acc, curr) => acc + (curr.budgetNormalized || 0), 0)

  return (
    <div className="space-y-6">
      {/* Top Console Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Total Enquiries</div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{totalCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Inbox className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Unreviewed / New</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{newCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">High Priority</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{highPriorityCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-400">Pipeline Est. Value</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalBudgetUSD)} USD</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Console Action & Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
              <span>Sodio Triage Console</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-mono border border-indigo-500/20">
                Live Console
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Review, filter, edit, and re-extract structured project enquiries in real-time.
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button
              onClick={() => setShowIngestModal(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Ingest Enquiries</span>
            </button>
          </div>
        </div>

        {/* Live Batch Ingestion Progress Bar (if active) */}
        {batchProgress.running && (
          <div className="p-4 rounded-xl bg-indigo-950/80 border border-indigo-500/40 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>{batchProgress.message}</span>
              </span>
              <span>
                {batchProgress.processed} / {batchProgress.total} items
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    batchProgress.total > 0
                      ? Math.min(100, Math.round((batchProgress.processed / batchProgress.total) * 100))
                      : 5
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Search & Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search company, name, email, query..."
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

        {/* Sort Controls Bar & Bulk Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
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

          <div className="flex items-center space-x-3">
            {/* Bulk Selection Action Bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center space-x-2 animate-fadeIn">
                <span className="text-indigo-300 font-semibold">{selectedIds.size} selected</span>
                <button
                  onClick={() => setShowDeleteSelectedModal(true)}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200"
                >
                  Deselect
                </button>
              </div>
            )}

            {/* Clear All Enquiries Button */}
            {enquiries.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-rose-400 hover:text-rose-200 border border-slate-800 hover:border-rose-800/80 transition-all text-xs font-medium"
                title="Wipe database and clear all enquiries"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All</span>
              </button>
            )}

            <div>
              Showing <strong className="text-slate-200">{enquiries.length}</strong> enquiries
            </div>
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
                      className={`hover:bg-slate-800/40 transition-colors group ${
                        selectedIds.has(item.id) ? 'bg-indigo-950/20' : ''
                      }`}
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
                                ? 'text-amber-300 font-semibold'
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
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${priorityStyle.badge}`}
                        >
                          <span>{item.priority}</span>
                        </span>
                      </td>

                      {/* Status Workflow Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as Status)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                        >
                          <option value="new" className="bg-slate-900 text-slate-100">New</option>
                          <option value="contacted" className="bg-slate-900 text-slate-100">Contacted</option>
                          <option value="qualified" className="bg-slate-900 text-slate-100">Qualified</option>
                          <option value="dropped" className="bg-slate-900 text-slate-100">Dropped</option>
                        </select>
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleReExtract(item.id)}
                          disabled={reExtractingId === item.id}
                          title="Re-run AI extraction"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${reExtractingId === item.id ? 'animate-spin text-indigo-400' : ''}`}
                          />
                        </button>
                        <Link
                          href={`/enquiries/${item.id}`}
                          title="Open Detail View"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors inline-block"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Delete Enquiry"
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Selected Confirmation Modal */}
      {showDeleteSelectedModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border-slate-700 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Delete Selected Enquiries</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-rose-400">{selectedIds.size}</strong> selected enquiry record(s) and their audit logs? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDeleteSelectedModal(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeletingSelected}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 disabled:opacity-50"
              >
                {isDeletingSelected ? 'Deleting...' : `Confirm Delete (${selectedIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Enquiries Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">⚠️ DANGER: Delete All Enquiries</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently wipe <strong className="text-rose-400">ALL {enquiries.length}</strong> enquiry records and audit history events from the database.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">
                Type <code className="text-rose-400 font-bold font-mono">DELETE</code> below to confirm wipe:
              </label>
              <input
                type="text"
                value={deleteAllConfirmText}
                onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3 py-2 bg-slate-950 border border-rose-500/50 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowDeleteAllModal(false)
                  setDeleteAllConfirmText('')
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAll}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isDeletingAll ? 'Wiping Database...' : 'Wipe All Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multiform Ingestion Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-xl w-full border-slate-700 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                <span>Ingest Project Enquiries</span>
              </h3>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Ingestion Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('paste')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'paste' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste Text</span>
              </button>
              <button
                onClick={() => setActiveTab('txt')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'txt' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Batch .txt File</span>
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'pdf' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Upload .pdf Document</span>
              </button>
            </div>

            {/* Tab 1: Paste Text */}
            {activeTab === 'paste' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Paste raw customer message or enquiry block below:
                  </label>
                  <button
                    onClick={handleLoadDemo}
                    className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Load demo enquiry</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste enquiry text here..."
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Tab 2 & 3: File Upload (.txt or .pdf) */}
            {(activeTab === 'txt' || activeTab === 'pdf') && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-300">
                  Select a <code className="text-indigo-300 font-mono">.{activeTab}</code> file containing project enquiries:
                </label>
                <input
                  type="file"
                  accept={activeTab === 'txt' ? '.txt' : '.pdf'}
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-xs file:font-semibold cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowIngestModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleStreamIngest}
                disabled={batchProgress.running}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {batchProgress.running ? 'Processing...' : 'Run Extraction Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}