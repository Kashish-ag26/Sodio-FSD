import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseEnquiriesFile, extractTextFromPdfBuffer } from '@/lib/parsing'
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

// POST /api/enquiries/batch - Stream NDJSON live progress for .txt and .pdf batch ingestion
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
        // Handle PDF vs Text file
        if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
          console.log(`[Batch Endpoint] Ingesting uploaded PDF file: ${file.name}`)
          try {
            const arrayBuffer = await file.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            rawTextContent = await extractTextFromPdfBuffer(buffer)
          } catch (pdfErr: any) {
            return NextResponse.json(
              { error: pdfErr.message || 'Failed to extract text from PDF file' },
              { status: 400 }
            )
          }
        } else {
          console.log(`[Batch Endpoint] Ingesting uploaded TXT file: ${file.name}`)
          rawTextContent = await file.text()
        }
      } else if (pastedText) {
        rawTextContent = pastedText
      }
    } else {
      const json = await request.json()
      rawTextContent = json.rawText || ''
    }

    if (!rawTextContent || !rawTextContent.trim()) {
      return NextResponse.json(
        { error: 'No readable file or text content provided for batch ingestion' },
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

    console.log(`[Batch Endpoint] Ingesting ${blocks.length} blocks with bounded concurrency = 3...`)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'))
          } catch (e) {
            // Stream closed
          }
        }

        sendEvent({ type: 'batch_started', total: blocks.length })

        await Promise.all(
          blocks.map((rawBlock, index) =>
            limit(async () => {
              sendEvent({ type: 'item_started', index, rawText: rawBlock.substring(0, 100) })

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

                const formatted = formatEnquiryRecord(record)
                console.log(`[Batch Endpoint] Completed item #${index + 1}: ${formatted.company || formatted.contactName || 'Enquiry'}`)
                sendEvent({ type: 'item_success', index, enquiry: formatted })
              } catch (err: any) {
                console.error(`[Batch Endpoint] Error processing block #${index + 1}:`, err)

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

                const formatted = formatEnquiryRecord(failedRecord)
                sendEvent({ type: 'item_failed', index, enquiry: formatted, error: err?.message || 'Extraction failed' })
              }
            })
          )
        )

        sendEvent({ type: 'batch_completed' })
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[API /api/enquiries/batch POST] Error:', error)
    return NextResponse.json(
      { error: 'Batch processing failed', details: error?.message },
      { status: 500 }
    )
  }
}