import { db } from '../src/lib/db'
import { parseEnquiriesFile } from '../src/lib/parsing'
import { extractEnquiry } from '../src/lib/llm/extractor'
import { computePriority } from '../src/lib/scoring'
import * as fs from 'fs'
import * as path from 'path'

async function seed() {
  console.log('🌱 Starting Sodio Enquiry Triage database seed...')

  // Path to sample enquiries file
  const sampleFilePath = path.join(__dirname, '..', 'sample-enquiries.txt')

  if (!fs.existsSync(sampleFilePath)) {
    console.error(`❌ Sample file not found at ${sampleFilePath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(sampleFilePath, 'utf-8')
  const rawEnquiries = parseEnquiriesFile(fileContent)

  console.log(`📄 Found ${rawEnquiries.length} raw enquiry blocks in sample file. Clear existing data...`)

  // Clear existing enquiries for clean seed
  await db.enquiry.deleteMany({})

  console.log(`⚡ Processing and seeding ${rawEnquiries.length} enquiries...`)

  let count = 0
  for (const rawText of rawEnquiries) {
    count++
    console.log(`[${count}/${rawEnquiries.length}] Extracting and scoring item...`)

    // Extract structured data
    const extraction = await extractEnquiry(rawText)

    // Compute priority deterministically
    const priority = computePriority(extraction)

    // Create record in SQLite database
    await db.enquiry.create({
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
        priority,
        status: 'new',
        extractionNotes: extraction.extractionNotes || null,
        humanEditedFields: JSON.stringify([]),
        previousExtraction: null,
        extractionVersion: 'v1.0.0',
        lastExtractedAt: new Date(),
      },
    })
  }

  console.log(`✅ Seed successfully completed! ${count} enquiries loaded into SQLite DB.`)
}

seed()
  .catch((err) => {
    console.error('❌ Error seeding database:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
