'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Edit3,
  Save,
  Clock,
  DollarSign,
  Briefcase,
  Mail,
  User,
  Building,
  ShieldAlert,
  History,
  Sparkles,
} from 'lucide-react'
import type { Enquiry, ServiceLine, Priority, Status } from '@/types/enquiry'
import {
  formatCurrency,
  formatDate,
  getPriorityColor,
  getServiceLineColor,
  getStatusColor,
} from '@/lib/utils'

export default function EnquiryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [enquiry, setEnquiry] = useState<Enquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Re-extraction & AI suggestions state
  const [isReExtracting, setIsReExtracting] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any> | null>(null)

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Enquiry>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Fetch Enquiry Details
  const fetchDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/enquiries/${id}`)
      if (!res.ok) throw new Error('Enquiry not found')
      const data = await res.json()
      setEnquiry(data)
      setEditValues(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load enquiry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchDetail()
  }, [id])

  // Re-extract enquiry
  const handleReExtract = async () => {
    setIsReExtracting(true)
    try {
      const res = await fetch(`/api/enquiries/${id}/re-extract`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Re-extraction failed')
      const result = await res.json()

      setEnquiry(result)
      setEditValues(result)

      if (result.aiSuggestions && Object.keys(result.aiSuggestions).length > 0) {
        setAiSuggestions(result.aiSuggestions)
      } else {
        setAiSuggestions(null)
      }
    } catch (err: any) {
      alert(`Re-extraction error: ${err.message}`)
    } finally {
      setIsReExtracting(false)
    }
  }

  // Save Inline Field Edit
  const handleSaveField = async (fieldName: keyof Enquiry) => {
    setIsSaving(true)
    try {
      const payload = {
        [fieldName]: editValues[fieldName],
      }

      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to save field edit')
      const updated = await res.json()
      setEnquiry(updated)
      setEditValues(updated)
      setEditingField(null)
    } catch (err: any) {
      alert(`Error saving edit: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Accept AI Suggestion for Human-Edited Field
  const handleAcceptAiSuggestion = async (fieldName: keyof Enquiry, suggestedValue: any) => {
    setIsSaving(true)
    try {
      const updatedHumanEdited = (enquiry?.humanEditedFields || []).filter((f) => f !== fieldName)

      const payload = {
        [fieldName]: suggestedValue,
        humanEditedFields: updatedHumanEdited,
      }

      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Failed to accept AI suggestion')
      const updated = await res.json()
      setEnquiry(updated)
      setEditValues(updated)

      if (aiSuggestions) {
        const nextSuggestions = { ...aiSuggestions }
        delete nextSuggestions[fieldName as string]
        setAiSuggestions(Object.keys(nextSuggestions).length > 0 ? nextSuggestions : null)
      }
    } catch (err: any) {
      alert(`Error accepting suggestion: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Copy raw text to clipboard
  const handleCopyRaw = () => {
    if (enquiry?.rawText) {
      navigator.clipboard.writeText(enquiry.rawText)
      setCopiedRaw(true)
      setTimeout(() => setCopiedRaw(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-indigo-400" />
        <p className="text-xs">Loading enquiry details...</p>
      </div>
    )
  }

  if (error || !enquiry) {
    return (
      <div className="py-20 text-center text-slate-400 space-y-4">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-400" />
        <h3 className="text-base font-bold text-slate-200">{error || 'Enquiry Not Found'}</h3>
        <Link
          href="/enquiries"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Console</span>
        </Link>
      </div>
    )
  }

  const priorityStyle = getPriorityColor(enquiry.priority)
  const isPromptInjection = enquiry.extractionNotes?.toLowerCase().includes('injection')

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border-slate-800">
        <div className="flex items-center space-x-3">
          <Link
            href="/enquiries"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100">
                {enquiry.company || enquiry.contactName || 'Enquiry Detail'}
              </h1>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityStyle.badge}`}>
                {enquiry.priority} priority
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ID: <code className="text-indigo-300 font-mono">{enquiry.id}</code> &bull; Received {formatDate(enquiry.receivedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Previous Snapshot Button */}
          {enquiry.previousExtraction && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>Prior Snapshot</span>
            </button>
          )}

          {/* Re-extract Action Button */}
          <button
            onClick={handleReExtract}
            disabled={isReExtracting}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isReExtracting ? 'animate-spin' : ''}`} />
            <span>{isReExtracting ? 'Re-extracting...' : 'Re-run Extraction'}</span>
          </button>
        </div>
      </div>

      {/* Security Alert Banner (Prompt Injection Warning) */}
      {isPromptInjection && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 space-y-1 glow-high">
          <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wide">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Adversarial Prompt Injection Attempt Flagged</span>
          </div>
          <p className="text-xs text-rose-200/90 pl-7">
            The extraction model detected embedded system commands in the source raw text attempting to override triage scoring rules. This message has been marked as <strong>non-genuine</strong> and automatically assigned <strong>low priority</strong>.
          </p>
        </div>
      )}

      {/* AI Suggestions Callout (if Re-extracted over Human Edited Fields) */}
      {aiSuggestions && Object.keys(aiSuggestions).length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
          <div className="flex items-center space-x-2 font-semibold text-xs text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Re-extraction Complete — AI Suggestions Available</span>
          </div>
          <p className="text-xs text-amber-200/80">
            Re-extraction updated untouched fields, but preserved your manually edited fields. Review new AI suggestions below:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {Object.entries(aiSuggestions).map(([fKey, suggestVal]) => (
              <div key={fKey} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 capitalize">{fKey}: </span>
                  <strong className="text-slate-200">{String(suggestVal)}</strong>
                </div>
                <button
                  onClick={() => handleAcceptAiSuggestion(fKey as keyof Enquiry, suggestVal)}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold"
                >
                  Accept AI Suggestion
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Pane Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Pane: Original Untouched Raw Text */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <span>Untouched Raw Source Text</span>
              </h3>
              <button
                onClick={handleCopyRaw}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                {copiedRaw ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedRaw ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto select-text">
              {enquiry.rawText}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>{enquiry.rawText.length} characters</span>
              <span>Extraction Engine: {enquiry.extractionVersion || 'v1.0'}</span>
            </div>
          </div>

          {/* Extraction Notes & Flags */}
          <div className="glass-panel p-4 rounded-xl border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Extraction Notes &amp; Security Audit</h4>
            <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              {enquiry.extractionNotes || 'No special flags or notes generated during extraction.'}
            </p>
          </div>
        </div>

        {/* Right Pane: Structured & Editable Extracted Fields */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Extracted Structured Fields</h3>
                <p className="text-xs text-slate-400">Click any field to edit manually. Edits are tracked and protected during re-extraction.</p>
              </div>
              
              {/* High-Contrast Status Dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-slate-400">Status:</span>
                <select
                  value={editValues.status || enquiry.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as Status
                    setEditValues((prev) => ({ ...prev, status: newStatus }))
                    handleSaveField('status')
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                >
                  <option value="new" className="bg-slate-900 text-slate-100">New</option>
                  <option value="contacted" className="bg-slate-900 text-slate-100">Contacted</option>
                  <option value="qualified" className="bg-slate-900 text-slate-100">Qualified</option>
                  <option value="dropped" className="bg-slate-900 text-slate-100">Dropped</option>
                </select>
              </div>
            </div>

            {/* Field Grid */}
            <div className="space-y-4 text-xs">
              {/* Summary Field */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-400">Summary</span>
                  {enquiry.humanEditedFields?.includes('summary') && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">Edited by human</span>
                  )}
                </div>
                {editingField === 'summary' ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={editValues.summary || ''}
                      onChange={(e) => setEditValues({ ...editValues, summary: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-indigo-500 rounded-lg text-slate-200 text-xs focus:outline-none"
                    />
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setEditingField(null)} className="px-2.5 py-1 rounded bg-slate-800 text-slate-400">Cancel</button>
                      <button onClick={() => handleSaveField('summary')} className="px-2.5 py-1 rounded bg-indigo-600 text-white font-semibold">Save</button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => setEditingField('summary')}
                    className="text-slate-200 leading-relaxed cursor-pointer hover:text-indigo-300 transition-colors"
                  >
                    {enquiry.summary || 'Click to add summary...'}
                  </p>
                )}
              </div>

              {/* Company & Contact Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Company */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>Company Name</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('company') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  {editingField === 'company' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={editValues.company || ''}
                        onChange={(e) => setEditValues({ ...editValues, company: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => handleSaveField('company')} className="p-1 rounded bg-indigo-600 text-white"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('company')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {enquiry.company || <span className="text-slate-500 italic">Not provided</span>}
                    </div>
                  )}
                </div>

                {/* Contact Name */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Contact Person</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('contactName') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  {editingField === 'contactName' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={editValues.contactName || ''}
                        onChange={(e) => setEditValues({ ...editValues, contactName: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => handleSaveField('contactName')} className="p-1 rounded bg-indigo-600 text-white"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('contactName')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {enquiry.contactName || <span className="text-slate-500 italic">Not provided</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Email & Service Line Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Contact Email */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>Email Address</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('contactEmail') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  {editingField === 'contactEmail' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="email"
                        value={editValues.contactEmail || ''}
                        onChange={(e) => setEditValues({ ...editValues, contactEmail: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => handleSaveField('contactEmail')} className="p-1 rounded bg-indigo-600 text-white"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('contactEmail')} className="font-mono text-indigo-300 cursor-pointer hover:underline">
                      {enquiry.contactEmail || <span className="text-slate-500 italic">Not provided</span>}
                    </div>
                  )}
                </div>

                {/* High-Contrast Service Line Dropdown */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>Service Line</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('serviceLine') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  <select
                    value={editValues.serviceLine || enquiry.serviceLine}
                    onChange={(e) => {
                      const newS = e.target.value as ServiceLine
                      setEditValues((prev) => ({ ...prev, serviceLine: newS }))
                      handleSaveField('serviceLine')
                    }}
                    className="mt-1 w-full px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                  >
                    <option value="ai" className="bg-slate-900 text-slate-100">AI / ML</option>
                    <option value="blockchain" className="bg-slate-900 text-slate-100">Blockchain / Web3</option>
                    <option value="web" className="bg-slate-900 text-slate-100">Web App</option>
                    <option value="mobile" className="bg-slate-900 text-slate-100">Mobile App</option>
                    <option value="game" className="bg-slate-900 text-slate-100">Game Dev</option>
                    <option value="other" className="bg-slate-900 text-slate-100">Other</option>
                  </select>
                </div>
              </div>

              {/* Budget & Timeline Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Budget */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Budget (As Written / Est USD)</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('budgetRaw') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  {editingField === 'budgetRaw' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={editValues.budgetRaw || ''}
                        onChange={(e) => setEditValues({ ...editValues, budgetRaw: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => handleSaveField('budgetRaw')} className="p-1 rounded bg-indigo-600 text-white"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('budgetRaw')} className="cursor-pointer hover:text-indigo-300">
                      <span className="font-semibold text-slate-200">{enquiry.budgetRaw}</span>
                      {enquiry.budgetNormalized !== null && enquiry.budgetNormalized !== undefined && (
                        <span className="ml-2 text-cyan-400 font-mono text-[11px]">
                          (≈ {formatCurrency(enquiry.budgetNormalized)} USD)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Timeline Phrase</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('timeline') && (
                      <span className="text-[10px] text-amber-400">Edited</span>
                    )}
                  </div>
                  {editingField === 'timeline' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={editValues.timeline || ''}
                        onChange={(e) => setEditValues({ ...editValues, timeline: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => handleSaveField('timeline')} className="p-1 rounded bg-indigo-600 text-white"><Save className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('timeline')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {enquiry.timeline}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority & Genuine Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <span className="font-semibold text-slate-400">Genuine Enquiry Flag</span>
                  <button
                    onClick={() => {
                      const nextVal = !enquiry.isGenuineEnquiry
                      setEditValues({ ...editValues, isGenuineEnquiry: nextVal })
                      handleSaveField('isGenuineEnquiry')
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      enquiry.isGenuineEnquiry
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {enquiry.isGenuineEnquiry ? 'Genuine Enquiry' : 'Non-Genuine / Spam'}
                  </button>
                </div>

                {/* High-Contrast Priority Dropdown */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <span className="font-semibold text-slate-400">Priority Score (Derived)</span>
                  <select
                    value={editValues.priority || enquiry.priority}
                    onChange={(e) => {
                      const p = e.target.value as Priority
                      setEditValues((prev) => ({ ...prev, priority: p }))
                      handleSaveField('priority')
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-slate-900 text-slate-100 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm"
                  >
                    <option value="high" className="bg-slate-900 text-slate-100">HIGH</option>
                    <option value="medium" className="bg-slate-900 text-slate-100">MEDIUM</option>
                    <option value="low" className="bg-slate-900 text-slate-100">LOW</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prior Snapshot History Modal */}
      {showHistoryModal && enquiry.previousExtraction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-lg w-full border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Prior Extraction Snapshot Audit</span>
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Snapshot recorded before last re-extraction on{' '}
              <code className="text-indigo-300">{formatDate(enquiry.lastExtractedAt)}</code>:
            </p>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-64">
              {JSON.stringify(enquiry.previousExtraction, null, 2)}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
