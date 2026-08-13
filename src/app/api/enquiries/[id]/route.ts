import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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

// GET /api/enquiries/[id] - Include history events ordered by newest first
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const enquiry = await db.enquiry.findUnique({
      where: { id },
      include: {
        historyEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    return NextResponse.json(formatEnquiryRecord(enquiry))
  } catch (error: any) {
    console.error(`[API /api/enquiries/${params.id} GET] Error:`, error)
    return NextResponse.json(
      { error: 'Failed to fetch enquiry', details: error?.message },
      { status: 500 }
    )
  }
}

// PUT /api/enquiries/[id] - Save manual edits (bulk or single) & log History Events
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // Find existing record
    const existing = await db.enquiry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    let existingEditedFields: string[] = []
    try {
      if (typeof existing.humanEditedFields === 'string') {
        existingEditedFields = JSON.parse(existing.humanEditedFields)
      } else if (Array.isArray(existing.humanEditedFields)) {
        existingEditedFields = existing.humanEditedFields
      }
    } catch (e) {
      existingEditedFields = []
    }

    const updatedEditedFields = new Set<string>(existingEditedFields)

    const editableFields = [
      'company',
      'contactName',
      'contactEmail',
      'serviceLine',
      'budgetRaw',
      'budgetNormalized',
      'timeline',
      'summary',
      'isGenuineEnquiry',
      'priority',
      'status',
      'extractionNotes',
    ]

    const updateData: any = {}
    const historyToCreate: {
      eventType: string
      fieldName?: string
      oldValue?: string
      newValue?: string
      notes?: string
    }[] = []

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        const oldValStr = String((existing as any)[field] ?? '')
        const newValStr = String(body[field] ?? '')

        // Only process if value actually changed
        if (oldValStr !== newValStr) {
          updateData[field] = body[field]
          
          if (field === 'status') {
            historyToCreate.push({
              eventType: 'status_change',
              fieldName: 'status',
              oldValue: oldValStr,
              newValue: newValStr,
              notes: `Status transitioned from ${oldValStr} to ${newValStr}`,
            })
          } else {
            updatedEditedFields.add(field)
            historyToCreate.push({
              eventType: 'manual_edit',
              fieldName: field,
              oldValue: oldValStr,
              newValue: newValStr,
              notes: `Field "${field}" updated by human operator`,
            })
          }
        }
      }
    }

    // Re-score priority if relevant fields changed and human hasn't explicitly set priority
    if (body.priority === undefined && !updatedEditedFields.has('priority')) {
      const mergedFields = {
        isGenuineEnquiry: updateData.isGenuineEnquiry ?? existing.isGenuineEnquiry,
        budgetNormalized: updateData.budgetNormalized ?? existing.budgetNormalized,
        timeline: updateData.timeline ?? existing.timeline,
        contactName: updateData.contactName ?? existing.contactName,
        contactEmail: updateData.contactEmail ?? existing.contactEmail,
        extractionNotes: updateData.extractionNotes ?? existing.extractionNotes,
      }
      updateData.priority = computePriority(mergedFields as any)
    }

    updateData.humanEditedFields = JSON.stringify(Array.from(updatedEditedFields))

    // Perform database update & batch history event creations
    const updatedRecord = await db.$transaction(async (tx) => {
      const updated = await tx.enquiry.update({
        where: { id },
        data: updateData,
      })

      if (historyToCreate.length > 0) {
        await tx.enquiryHistoryEvent.createMany({
          data: historyToCreate.map((item) => ({
            enquiryId: id,
            ...item,
          })),
        })
      }

      return tx.enquiry.findUnique({
        where: { id },
        include: {
          historyEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })
    })

    return NextResponse.json(formatEnquiryRecord(updatedRecord))
  } catch (error: any) {
    console.error(`[API /api/enquiries/${params.id} PUT] Error:`, error)
    return NextResponse.json(
      { error: 'Failed to update enquiry', details: error?.message },
      { status: 500 }
    )
  }
}

// DELETE /api/enquiries/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    await db.enquiry.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Enquiry deleted successfully' })
  } catch (error: any) {
    console.error(`[API /api/enquiries/${params.id} DELETE] Error:`, error)
    return NextResponse.json(
      { error: 'Failed to delete enquiry', details: error?.message },
      { status: 500 }
    )
  }
}