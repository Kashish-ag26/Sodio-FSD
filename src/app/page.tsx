'use client'

import { useState, useEffect, useTransition } from 'react'
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
  CheckCircle2,
  XCircle,
  Filter,
  ArrowUpDown,
  Plus,
  Sparkles,
  Inbox,
  UserCheck,
  TrendingUp,
  Clock,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import type { Enquiry, ServiceLine, Priority, Status } from '@/types/enquiry'
import {
  formatCurrency,
  formatDate,
  getPriorityColor,
  getServiceLineColor,
  getStatusColor,
} from '@/lib/utils'

export default function EnquiryConsolePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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

  // Modals
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [batchProgress, setBatchProgress] = useState<{
    running: boolean
    total: number
    processed: number
    message: string
  }>({ running: false, total: 0, processed: 0, message: '' })

  const [reExtractingId, setReExtractingId] = useState<string | null>(null)

  // Fetch enquiries
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

  // Re-extract enquiry
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

  // Batch ingestion submission (File or Paste)
  const handleBatchIngest = async (fileToUpload?: File, textToIngest?: string) => {
    setBatchProgress({ running: true, total: 0, processed: 0, message: 'Parsing and splitting enquiry blocks...' })

    try {
      const formData = new FormData()
      if (fileToUpload) {
        formData.append('file', fileToUpload)
      } else if (textToIngest) {
        formData.append('rawText', textToIngest)
      } else {
        throw new Error('No input provided')
      }

      const res = await fetch('/api/enquiries/batch', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Batch ingestion failed')
      }

      const result = await res.json()
      setBatchProgress({
        running: false,
        total: result.total,
        processed: result.processed,
        message: result.message,
      })

      setShowBatchModal(false)
      setShowPasteModal(false)
      setPasteText('')
      setBatchFile(null)
      loadEnquiries()
    } catch (err: any) {
      alert(`Batch Ingestion Error: ${err.message}`)
      setBatchProgress({ running: false, total: 0, processed: 0, message: '' })
    }
  }

  // Checkbox Selection
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
            <span>Project Enquiry Console</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingest raw enquiry messages, extract structured fields, and score deal priority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Batch File</span>
          </button>

          <button
            onClick={() => setShowPasteModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            <span>Paste Raw Enquiry</span>
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
              No enquiry records match your current filters. Click "Upload Batch File" to upload the sample file or seed the database.
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
                  <th className="py-3 px-4">Company & Sender</th>
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
                              {!item.isGenuineEnquiry && (
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

      {/* Batch Progress Banner Overlay (if active) */}
      {batchProgress.running && (
        <div className="fixed bottom-6 right-6 z-50 glass-panel p-4 rounded-xl border-indigo-500/40 shadow-2xl max-w-md w-full animate-pulse-subtle">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <div>
              <h4 className="text-xs font-bold text-slate-100">Batch Pipeline Running</h4>
              <p className="text-[11px] text-slate-400">{batchProgress.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Batch File Upload Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-lg w-full border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-indigo-400" />
                <span>Upload Batch Enquiries File</span>
              </h3>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload a plain text file (such as <code className="text-indigo-300">sample-enquiries.txt</code>) containing raw enquiries separated by dashed lines (<code className="text-indigo-300">---</code>).
            </p>

            <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-6 text-center space-y-3 bg-slate-900/50 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-indigo-400" />
              <div>
                <label className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  <span>Choose file from disk</span>
                  <input
                    type="file"
                    accept=".txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setBatchFile(e.target.files[0])
                    }}
                  />
                </label>
                {batchFile && (
                  <p className="text-xs text-emerald-400 font-mono mt-2">
                    Selected: {batchFile.name} ({(batchFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={!batchFile}
                onClick={() => batchFile && handleBatchIngest(batchFile)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
              >
                Start Processing Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Raw Text Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-xl w-full border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Paste Raw Enquiry Text</span>
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste raw enquiry text below. If pasting multiple, separate them with dashed lines (<code className="text-indigo-300">---</code>).
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste raw text message from client here..."
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={!pasteText.trim()}
                onClick={() => handleBatchIngest(undefined, pasteText)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50"
              >
                Ingest & Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
