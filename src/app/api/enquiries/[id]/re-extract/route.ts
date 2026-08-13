import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractEnquiry } from '@/lib/llm/extractor'
import { computePriority } from '@/lib/scoring'

function formatEnquiryRecord(record: any) {
  let humanEditedFields: string[] = []
  try {
    if (typeof record.humanEditedFields === 'string') {
      humanEditedFields = JSON.parse(record.humanEditedFields)
    } else if (Array.isArray(record.humanEditedFields)) {
      humanEditedFields = record.humanEditedFields
    }
  } catch (e) {
    humanEditedFields = []
  }

  let previousExtraction = null
  try {
    if (typeof record.previousExtraction === 'string' && record.previousExtraction) {
      previousExtraction = JSON.parse(record.previousExtraction)
    } else if (record.previousExtraction && typeof record.previousExtraction === 'object') {
      previousExtraction = record.previousExtraction
    }
  } catch (e) {
    previousExtraction = null
  }

  return {
    ...record,
    humanEditedFields,
    previousExtraction,
  }
}

// POST /api/enquiries/[id]/re-extract - Re-run LLM extraction safely and log history event
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const enquiry = await db.enquiry.findUnique({ where: { id } })
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    // Save snapshot of current state before re-extracting
    const currentSnapshot = {
      company: enquiry.company,
      contactName: enquiry.contactName,
      contactEmail: enquiry.contactEmail,
      serviceLine: enquiry.serviceLine,
      budgetRaw: enquiry.budgetRaw,
      budgetNormalized: enquiry.budgetNormalized,
      timeline: enquiry.timeline,
      summary: enquiry.summary,
      isGenuineEnquiry: enquiry.isGenuineEnquiry,
      extractionNotes: enquiry.extractionNotes,
      snapshotTimestamp: new Date().toISOString(),
    }

    // Run new extraction on raw text
    const newExtraction = await extractEnquiry(enquiry.rawText)

    // Parse humanEditedFields list
    let humanEditedFields: string[] = []
    try {
      if (typeof enquiry.humanEditedFields === 'string') {
        humanEditedFields = JSON.parse(enquiry.humanEditedFields)
      } else if (Array.isArray(enquiry.humanEditedFields)) {
        humanEditedFields = enquiry.humanEditedFields
      }
    } catch (e) {
      humanEditedFields = []
    }

    const fieldsToExtract = [
      'company',
      'contactName',
      'contactEmail',
      'serviceLine',
      'budgetRaw',
      'budgetNormalized',
      'timeline',
      'summary',
      'isGenuineEnquiry',
      'extractionNotes',
    ]

    const updateData: any = {
      previousExtraction: JSON.stringify(currentSnapshot),
      lastExtractedAt: new Date(),
      extractionVersion: `v1.${Date.now()}`,
    }

    // Track AI suggested values for human-edited fields so UI can offer "Accept AI Suggestion"
    const aiSuggestions: Record<string, any> = {}
    const updatedAiFields: string[] = []
    const protectedHumanFields: string[] = []

    for (const field of fieldsToExtract) {
      const newAiVal = (newExtraction as any)[field]

      if (humanEditedFields.includes(field)) {
        // Human has edited this field - KEEP human value in DB!
        updateData[field] = (enquiry as any)[field]
        aiSuggestions[field] = newAiVal
        protectedHumanFields.push(field)
      } else {
        // Untouched field - update freely with new AI extraction
        updateData[field] = newAiVal
        updatedAiFields.push(field)
      }
    }

    // Re-score priority based on effective fields
    if (!humanEditedFields.includes('priority')) {
      const effectiveFields = {
        isGenuineEnquiry: updateData.isGenuineEnquiry,
        budgetNormalized: updateData.budgetNormalized,
        timeline: updateData.timeline,
        contactName: updateData.contactName,
        contactEmail: updateData.contactEmail,
        extractionNotes: updateData.extractionNotes,
      }
      updateData.priority = computePriority(effectiveFields as any)
    }

    const reExtractNotes = protectedHumanFields.length > 0
      ? `Re-extraction complete. Updated ${updatedAiFields.length} field(s) via AI. Protected human-edited field(s): ${protectedHumanFields.join(', ')}.`
      : `Re-extraction complete. Updated all structured fields via AI.`

    // Update DB record and create history event atomically
    const updatedRecord = await db.$transaction(async (tx) => {
      await tx.enquiry.update({
        where: { id },
        data: updateData,
      })

      await tx.enquiryHistoryEvent.create({
        data: {
          enquiryId: id,
          eventType: 're_extraction',
          fieldName: null,
          oldValue: null,
          newValue: null,
          notes: reExtractNotes,
        },
      })

      return tx.enquiry.findUnique({
        where: { id },
        include: {
          historyEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })
    })

    const formatted = formatEnquiryRecord(updatedRecord)

    return NextResponse.json({
      ...formatted,
      aiSuggestions, // Pass suggestions for human-edited fields
      reExtractedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error(`[API /api/enquiries/${params.id}/re-extract POST] Error:`, error)
    return NextResponse.json(
      { error: 'Re-extraction failed', details: error?.message },
      { status: 500 }
    )
  }
}