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
  Activity,
  FileCheck,
} from 'lucide-react'
import type { Enquiry, ServiceLine, Priority, Status, EnquiryHistoryEvent } from '@/types/enquiry'
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

  // Draft editing state for explicitly tracking dirty unsaved edits
  const [draft, setDraft] = useState<Partial<Enquiry>>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Unsaved edits confirmation warning modal state
  const [showUnsavedWarningModal, setShowUnsavedWarningModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<'navigate' | 'reextract' | null>(null)

  // Check if draft differs from saved DB enquiry state
  const getChangedFields = () => {
    if (!enquiry) return {}
    const changed: Record<string, any> = {}

    const checkKeys: (keyof Enquiry)[] = [
      'company',
      'contactName',
      'contactEmail',
      'serviceLine',
      'budgetRaw',
      'timeline',
      'summary',
      'isGenuineEnquiry',
      'priority',
      'status',
    ]

    for (const key of checkKeys) {
      if (draft[key] !== undefined && draft[key] !== enquiry[key]) {
        changed[key] = draft[key]
      }
    }

    return changed
  }

  const changedFields = getChangedFields()
  const hasUnsavedEdits = Object.keys(changedFields).length > 0

  // Fetch Enquiry Details
  const fetchDetail = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/enquiries/${id}`)
      if (!res.ok) throw new Error('Enquiry not found')
      const data = await res.json()
      setEnquiry(data)
      setDraft(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load enquiry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchDetail()
  }, [id])

  // Save All Unsaved Edits explicitly
  const handleSaveChanges = async () => {
    if (!enquiry || !hasUnsavedEdits) return
    setIsSaving(true)

    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changedFields),
      })

      if (!res.ok) throw new Error('Failed to save changes')
      const updated = await res.json()
      setEnquiry(updated)
      setDraft(updated)
      setEditingField(null)
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 3000)
    } catch (err: any) {
      alert(`Error saving changes: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Trigger Re-extraction with Unsaved Check
  const triggerReExtract = () => {
    if (hasUnsavedEdits) {
      setPendingAction('reextract')
      setShowUnsavedWarningModal(true)
    } else {
      executeReExtract()
    }
  }

  // Execute Re-extraction API call
  const executeReExtract = async () => {
    setIsReExtracting(true)
    setShowUnsavedWarningModal(false)
    try {
      const res = await fetch(`/api/enquiries/${id}/re-extract`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Re-extraction failed')
      const result = await res.json()

      setEnquiry(result)
      setDraft(result)

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

  // Trigger Back Navigation with Unsaved Check
  const triggerBackNav = () => {
    if (hasUnsavedEdits) {
      setPendingAction('navigate')
      setShowUnsavedWarningModal(true)
    } else {
      router.push('/enquiries')
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
      setDraft(updated)

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
      {/* Top Header Bar with Explicit Save Changes Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={triggerBackNav}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Back to Console"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100">
                {enquiry.company || enquiry.contactName || 'Enquiry Detail'}
              </h1>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityStyle.badge}`}>
                {enquiry.priority} priority
              </span>
              {hasUnsavedEdits && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold animate-pulse">
                  Unsaved Edits
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ID: <code className="text-indigo-300 font-mono">{enquiry.id}</code> &bull; Received {formatDate(enquiry.receivedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Explicit Save Changes Button */}
          <button
            onClick={handleSaveChanges}
            disabled={!hasUnsavedEdits || isSaving}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              hasUnsavedEdits
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : showSavedToast ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Saving...' : showSavedToast ? 'Saved!' : 'Save Changes'}</span>
          </button>

          {/* Re-extract Action Button */}
          <button
            onClick={triggerReExtract}
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
        {/* Left Pane: Original Untouched Raw Text & Extraction Notes */}
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

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto select-text">
              {enquiry.rawText}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>{enquiry.rawText.length} characters</span>
              <span>Extraction Engine: {enquiry.extractionVersion || 'v1.0'}</span>
            </div>
          </div>

          {/* Extraction Notes */}
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
                <p className="text-xs text-slate-400">Edit fields below, then click "Save Changes" to persist all updates to SQLite.</p>
              </div>

              {/* Status Dropdown */}
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-semibold text-slate-400">Status:</span>
                <select
                  value={draft.status || enquiry.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as Status
                    setDraft((prev) => ({ ...prev, status: newStatus }))
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">Protected Edit</span>
                  )}
                </div>
                {editingField === 'summary' ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={draft.summary || ''}
                      onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-indigo-500 rounded-lg text-slate-200 text-xs focus:outline-none"
                    />
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setEditingField(null)} className="px-2.5 py-1 rounded bg-slate-800 text-slate-400">Done</button>
                    </div>
                  </div>
                ) : (
                  <p
                    onClick={() => setEditingField('summary')}
                    className="text-slate-200 leading-relaxed cursor-pointer hover:text-indigo-300 transition-colors"
                  >
                    {draft.summary || 'Click to add summary...'}
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
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  {editingField === 'company' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={draft.company || ''}
                        onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => setEditingField(null)} className="p-1 rounded bg-slate-800 text-slate-300"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('company')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {draft.company || <span className="text-slate-500 italic">Not provided</span>}
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
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  {editingField === 'contactName' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={draft.contactName || ''}
                        onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => setEditingField(null)} className="p-1 rounded bg-slate-800 text-slate-300"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('contactName')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {draft.contactName || <span className="text-slate-500 italic">Not provided</span>}
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
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  {editingField === 'contactEmail' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="email"
                        value={draft.contactEmail || ''}
                        onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => setEditingField(null)} className="p-1 rounded bg-slate-800 text-slate-300"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('contactEmail')} className="font-mono text-indigo-300 cursor-pointer hover:underline">
                      {draft.contactEmail || <span className="text-slate-500 italic">Not provided</span>}
                    </div>
                  )}
                </div>

                {/* Service Line Dropdown */}
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold flex items-center space-x-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>Service Line</span>
                    </span>
                    {enquiry.humanEditedFields?.includes('serviceLine') && (
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  <select
                    value={draft.serviceLine || enquiry.serviceLine}
                    onChange={(e) => {
                      const newS = e.target.value as ServiceLine
                      setDraft((prev) => ({ ...prev, serviceLine: newS }))
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
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  {editingField === 'budgetRaw' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={draft.budgetRaw || ''}
                        onChange={(e) => setDraft({ ...draft, budgetRaw: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => setEditingField(null)} className="p-1 rounded bg-slate-800 text-slate-300"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('budgetRaw')} className="cursor-pointer hover:text-indigo-300">
                      <span className="font-semibold text-slate-200">{draft.budgetRaw}</span>
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
                      <span className="text-[10px] text-amber-400">Protected Edit</span>
                    )}
                  </div>
                  {editingField === 'timeline' ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={draft.timeline || ''}
                        onChange={(e) => setDraft({ ...draft, timeline: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-slate-200 text-xs"
                      />
                      <button onClick={() => setEditingField(null)} className="p-1 rounded bg-slate-800 text-slate-300"><Check className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div onClick={() => setEditingField('timeline')} className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-300">
                      {draft.timeline}
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
                      const nextVal = !draft.isGenuineEnquiry
                      setDraft({ ...draft, isGenuineEnquiry: nextVal })
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                      draft.isGenuineEnquiry
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {draft.isGenuineEnquiry ? 'Genuine Enquiry' : 'Non-Genuine / Spam'}
                  </button>
                </div>

                {/* Priority Dropdown */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/80">
                  <span className="font-semibold text-slate-400">Priority Score</span>
                  <select
                    value={draft.priority || enquiry.priority}
                    onChange={(e) => {
                      const p = e.target.value as Priority
                      setDraft((prev) => ({ ...prev, priority: p }))
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

          {/* Component 2: Edit History Log Section */}
          <div className="glass-panel p-5 rounded-2xl border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Enquiry Audit History Log</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                {(enquiry.historyEvents || []).length} recorded event(s)
              </span>
            </div>

            {(!enquiry.historyEvents || enquiry.historyEvents.length === 0) ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">
                No audit events recorded yet for this enquiry.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {enquiry.historyEvents.map((evt) => {
                  const isStatus = evt.eventType === 'status_change'
                  const isManual = evt.eventType === 'manual_edit'
                  const isReExtract = evt.eventType === 're_extraction'

                  return (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/90 text-xs space-y-1 transition-all hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center space-x-2 font-medium">
                          {isStatus && <Activity className="w-3.5 h-3.5 text-amber-400" />}
                          {isManual && <Edit3 className="w-3.5 h-3.5 text-indigo-400" />}
                          {isReExtract && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                          <span className="font-semibold text-slate-200 capitalize">
                            {isStatus ? 'Status Changed' : isManual ? `Manual Edit: ${evt.fieldName}` : 'AI Re-extraction'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDate(evt.createdAt)}
                        </span>
                      </div>

                      {evt.oldValue !== null && evt.newValue !== null && (
                        <div className="text-[11px] text-slate-300 pl-5 flex items-center space-x-2">
                          <span className="text-slate-500 line-through">{evt.oldValue || 'blank'}</span>
                          <span className="text-slate-400">&rarr;</span>
                          <strong className="text-emerald-300 font-mono">{evt.newValue}</strong>
                        </div>
                      )}

                      {evt.notes && (
                        <p className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                          {evt.notes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Warning Modal */}
      {showUnsavedWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-md w-full border-slate-700 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-100">Unsaved Changes Warning</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You have unsaved field edits. Would you like to save changes before proceeding or discard your unsaved draft?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowUnsavedWarningModal(false)
                  setDraft(enquiry)
                  if (pendingAction === 'navigate') router.push('/enquiries')
                  else if (pendingAction === 'reextract') executeReExtract()
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Discard Edits
              </button>
              <button
                onClick={async () => {
                  await handleSaveChanges()
                  setShowUnsavedWarningModal(false)
                  if (pendingAction === 'navigate') router.push('/enquiries')
                  else if (pendingAction === 'reextract') executeReExtract()
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30"
              >
                Save &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}

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
