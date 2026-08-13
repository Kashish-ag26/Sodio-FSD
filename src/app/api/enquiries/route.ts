import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { extractEnquiry } from '@/lib/llm/extractor'
import { computePriority } from '@/lib/scoring'

// Helper to format DB record into clean Enquiry object
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

// GET /api/enquiries - List enquiries with filtering and sorting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceLine = searchParams.get('serviceLine')
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const search = searchParams.get('search') || searchParams.get('q')
    const sortBy = searchParams.get('sortBy') || 'receivedAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    const where: any = {}

    if (serviceLine && serviceLine !== 'all') {
      where.serviceLine = serviceLine
    }
    if (priority && priority !== 'all') {
      where.priority = priority
    }
    if (status && status !== 'all') {
      where.status = status
    }
    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { company: { contains: q } },
        { contactName: { contains: q } },
        { contactEmail: { contains: q } },
        { summary: { contains: q } },
        { rawText: { contains: q } },
        { budgetRaw: { contains: q } },
      ]
    }

    // Build orderBy clause
    const orderBy: any = {}
    if (sortBy === 'priority') {
      // Return raw list and sort in-memory for priority custom order (high -> medium -> low)
      const rawRecords = await db.enquiry.findMany({ where })
      const priorityWeights: Record<string, number> = { high: 3, medium: 2, low: 1 }

      rawRecords.sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 0
        const weightB = priorityWeights[b.priority] || 0
        return sortOrder === 'desc' ? weightB - weightA : weightA - weightB
      })

      return NextResponse.json(rawRecords.map(formatEnquiryRecord))
    }

    if (sortBy === 'budgetNormalized') {
      orderBy.budgetNormalized = sortOrder
    } else {
      orderBy.receivedAt = sortOrder
    }

    const records = await db.enquiry.findMany({
      where,
      orderBy,
    })

    return NextResponse.json(records.map(formatEnquiryRecord))
  } catch (error: any) {
    console.error('[API /api/enquiries GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enquiries', details: error?.message },
      { status: 500 }
    )
  }
}

// POST /api/enquiries - Create single enquiry manually or from single paste
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const rawText = body.rawText

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return NextResponse.json(
        { error: 'rawText field is required' },
        { status: 400 }
      )
    }

    // Extract fields via LLM or fallback
    const extraction = await extractEnquiry(rawText)

    // Compute priority
    const priority = computePriority(extraction)

    // Create database entry
    const newEnquiry = await db.enquiry.create({
      data: {
        rawText,
        company: extraction.company || null,
        contactName: extraction.contactName || null,
        contactEmail: extraction.contactEmail || null,
        serviceLine: extraction.serviceLine || 'other',
        budgetRaw: extraction.budgetRaw || 'TBD',
        budgetNormalized: extraction.budgetNormalized ?? null,
        timeline: extraction.timeline || 'TBD',
        summary: extraction.summary || '',
        isGenuineEnquiry: extraction.isGenuineEnquiry ?? true,
        extractionNotes: extraction.extractionNotes || null,
        priority,
        status: 'new',
        humanEditedFields: JSON.stringify([]),
        previousExtraction: null,
        extractionVersion: 'v1.0.0',
        lastExtractedAt: new Date(),
      },
    })

    return NextResponse.json(formatEnquiryRecord(newEnquiry), { status: 201 })
  } catch (error: any) {
    console.error('[API /api/enquiries POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create enquiry', details: error?.message },
      { status: 500 }
    )
  }
}

// DELETE /api/enquiries - Bulk delete selected enquiries or clear all enquiries
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { ids, deleteAll } = body

    if (deleteAll === true) {
      const result = await db.enquiry.deleteMany({})
      return NextResponse.json({
        success: true,
        message: 'All enquiries deleted successfully',
        deletedCount: result.count,
      })
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const result = await db.enquiry.deleteMany({
        where: { id: { in: ids } },
      })
      return NextResponse.json({
        success: true,
        message: `${result.count} enquiries deleted successfully`,
        deletedCount: result.count,
      })
    }

    return NextResponse.json(
      { error: 'Invalid request payload: specify ids array or deleteAll: true' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('[API /api/enquiries DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to bulk delete enquiries', details: error?.message },
      { status: 500 }
    )
  }
}