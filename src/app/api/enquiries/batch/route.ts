import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseEnquiriesFile } from '@/lib/parsing'
import { extractEnquiry } from '@/lib/llm/extractor'
import { computePriority } from '@/lib/scoring'
import pLimit from 'p-limit'

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

// POST /api/enquiries/batch - File upload or paste of multiple enquiries with bounded concurrency
export async function POST(request: Request) {
  const limit = pLimit(3) // Bound LLM concurrency to 3 parallel requests

  try {
    let rawTextContent = ''

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const pastedText = formData.get('rawText') as string | null

      if (file) {
        rawTextContent = await file.text()
      } else if (pastedText) {
        rawTextContent = pastedText
      }
    } else {
      const json = await request.json()
      rawTextContent = json.rawText || ''
    }

    if (!rawTextContent || !rawTextContent.trim()) {
      return NextResponse.json(
        { error: 'No file or text content provided for batch ingestion' },
        { status: 400 }
      )
    }

    // Split text into individual raw enquiry blocks
    const blocks = parseEnquiriesFile(rawTextContent)

    if (blocks.length === 0) {
      return NextResponse.json(
        { error: 'No valid enquiry blocks found in input file/text' },
        { status: 400 }
      )
    }

    let processedCount = 0
    let successCount = 0
    let failCount = 0

    const results = await Promise.all(
      blocks.map((rawBlock, index) =>
        limit(async () => {
          try {
            // Extract using LLM engine
            const extraction = await extractEnquiry(rawBlock)

            // Compute priority deterministically
            const priority = computePriority(extraction)

            // Save to database
            const record = await db.enquiry.create({
              data: {
                rawText: rawBlock,
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

            processedCount++
            successCount++
            return { index, success: true, enquiry: formatEnquiryRecord(record) }
          } catch (err: any) {
            console.error(`[Batch Processing] Failed block ${index + 1}:`, err)
            processedCount++
            failCount++

            // Create a failed record in DB for visibility & retry
            const failedRecord = await db.enquiry.create({
              data: {
                rawText: rawBlock,
                company: 'Extraction Error',
                contactName: 'N/A',
                contactEmail: 'N/A',
                serviceLine: 'other',
                budgetRaw: 'N/A',
                budgetNormalized: null,
                timeline: 'N/A',
                summary: 'Failed to extract structured enquiry details.',
                isGenuineEnquiry: false,
                extractionNotes: `Extraction error: ${err?.message || String(err)}`,
                priority: 'low',
                status: 'new',
                humanEditedFields: JSON.stringify([]),
                previousExtraction: null,
                extractionVersion: null,
                lastExtractedAt: null,
              },
            })

            return { index, success: false, enquiry: formatEnquiryRecord(failedRecord), error: err?.message }
          }
        })
      )
    )

    const createdEnquiries = results.map((r) => r.enquiry)

    return NextResponse.json({
      total: blocks.length,
      processed: processedCount,
      successful: successCount,
      failed: failCount,
      message:
        failCount > 0
          ? `Batch complete: ${successCount} processed successfully, ${failCount} failed (visible in console with retry option).`
          : `Batch complete: All ${successCount} enquiries ingested and processed successfully.`,
      enquiries: createdEnquiries,
    })
  } catch (error: any) {
    console.error('[API /api/enquiries/batch POST] Error:', error)
    return NextResponse.json(
      { error: 'Batch processing failed', details: error?.message },
      { status: 500 }
    )
  }
}