export type ServiceLine = 'ai' | 'blockchain' | 'web' | 'mobile' | 'game' | 'other'
export type Priority = 'high' | 'medium' | 'low'
export type Status = 'new' | 'contacted' | 'qualified' | 'dropped'

export interface EnquiryHistoryEvent {
  id: string
  enquiryId: string
  eventType: 'manual_edit' | 'status_change' | 're_extraction' | 'ingested' | string
  fieldName?: string | null
  oldValue?: string | null
  newValue?: string | null
  notes?: string | null
  createdAt: string | Date
}

export interface ExtractionResult {
  company: string
  contactName: string
  contactEmail: string
  serviceLine: ServiceLine
  budgetRaw: string
  budgetNormalized: number | null
  timeline: string
  summary: string
  isGenuineEnquiry: boolean
  extractionNotes: string | null
}

export interface Enquiry {
  id: string
  rawText: string
  receivedAt: string | Date
  company?: string | null
  contactName?: string | null
  contactEmail?: string | null
  serviceLine: ServiceLine
  budgetRaw: string
  budgetNormalized?: number | null
  timeline: string
  summary: string
  isGenuineEnquiry: boolean
  extractionNotes?: string | null
  priority: Priority
  status: Status
  humanEditedFields: string[] // Array of field names modified by human
  previousExtraction?: ExtractionResult | null // Snapshot of prior extraction result
  extractionVersion?: string | null
  lastExtractedAt?: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  historyEvents?: EnquiryHistoryEvent[]
}

export interface BatchItemResult {
  index: number
  success: boolean
  enquiry: Enquiry
  error?: string
}

export interface BatchProcessingSummary {
  total: number
  processed: number
  successful: number
  failed: number
  message: string
  enquiries: Enquiry[]
}