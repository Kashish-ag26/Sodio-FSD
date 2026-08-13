import { createClient } from '@libsql/client'
import { parseEnquiriesFile } from '../src/lib/parsing'
import { extractEnquiry } from '../src/lib/llm/extractor'
import { computePriority } from '../src/lib/scoring'
import * as fs from 'fs'
import * as path from 'path'

async function setupAndSeedTurso() {
  console.log('🚀 Initializing Turso Cloud Database Setup & Seeding...')

  const tursoUrl = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!tursoUrl || !authToken) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in environment!')
    process.exit(1)
  }

  const client = createClient({ url: tursoUrl, authToken })

  // 1. Create Tables DDL on Turso
  console.log('📦 Creating database tables on Turso...')
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "Enquiry" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "rawText" TEXT NOT NULL,
        "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "company" TEXT,
        "contactName" TEXT,
        "contactEmail" TEXT,
        "serviceLine" TEXT NOT NULL DEFAULT 'other',
        "budgetRaw" TEXT NOT NULL DEFAULT 'TBD',
        "budgetNormalized" REAL,
        "timeline" TEXT NOT NULL DEFAULT 'TBD',
        "summary" TEXT NOT NULL DEFAULT '',
        "isGenuineEnquiry" BOOLEAN NOT NULL DEFAULT true,
        "extractionNotes" TEXT,
        "priority" TEXT NOT NULL DEFAULT 'low',
        "status" TEXT NOT NULL DEFAULT 'new',
        "humanEditedFields" TEXT NOT NULL DEFAULT '[]',
        "previousExtraction" TEXT,
        "extractionVersion" TEXT,
        "lastExtractedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS "EnquiryHistoryEvent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "enquiryId" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "fieldName" TEXT,
        "oldValue" TEXT,
        "newValue" TEXT,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("enquiryId") REFERENCES "Enquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `)

  await client.execute(`CREATE INDEX IF NOT EXISTS "EnquiryHistoryEvent_enquiryId_idx" ON "EnquiryHistoryEvent"("enquiryId");`)
  await client.execute(`CREATE INDEX IF NOT EXISTS "EnquiryHistoryEvent_createdAt_idx" ON "EnquiryHistoryEvent"("createdAt");`)

  console.log('✅ Tables & indexes created on Turso successfully!')

  // 2. Clear existing rows if any
  const existingCountRes = await client.execute('SELECT COUNT(*) as cnt FROM "Enquiry"')
  const count = Number(existingCountRes.rows[0]?.cnt || 0)
  console.log(`📊 Current enquiry count in Turso DB: ${count}`)

  if (count > 0) {
    console.log('ℹ️ Turso database already has data. Clearing existing rows for fresh seed...')
    await client.execute('DELETE FROM "EnquiryHistoryEvent"')
    await client.execute('DELETE FROM "Enquiry"')
  }

  // 3. Parse sample-enquiries.txt
  const sampleFilePath = path.join(process.cwd(), 'sample-enquiries.txt')
  if (!fs.existsSync(sampleFilePath)) {
    console.error(`❌ sample-enquiries.txt not found at ${sampleFilePath}`)
    process.exit(1)
  }

  const rawFileContent = fs.readFileSync(sampleFilePath, 'utf-8')
  const blocks = parseEnquiriesFile(rawFileContent)
  console.log(`📄 Found ${blocks.length} raw enquiry blocks in sample file. Processing extractions via LLM...`)

  // 4. Ingest each enquiry block into Turso
  let successCount = 0
  for (let i = 0; i < blocks.length; i++) {
    const rawText = blocks[i]
    console.log(`  Processing [${i + 1}/${blocks.length}]...`)

    try {
      const extracted = await extractEnquiry(rawText)
      const priority = computePriority(extracted)
      const id = `enq_turso_${Date.now()}_${i + 1}`
      const nowStr = new Date().toISOString()

      await client.execute({
        sql: `INSERT INTO "Enquiry" (
          id, rawText, company, contactName, contactEmail, serviceLine,
          budgetRaw, budgetNormalized, timeline, summary, isGenuineEnquiry,
          extractionNotes, priority, status, humanEditedFields, extractionVersion,
          lastExtractedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          rawText,
          extracted.company || null,
          extracted.contactName || null,
          extracted.contactEmail || null,
          extracted.serviceLine || 'other',
          extracted.budgetRaw || 'TBD',
          extracted.budgetNormalized || null,
          extracted.timeline || 'TBD',
          extracted.summary || '',
          extracted.isGenuineEnquiry ? 1 : 0,
          extracted.extractionNotes || null,
          priority,
          'new',
          '[]',
          'v1.0-turso',
          nowStr,
          nowStr,
          nowStr,
        ],
      })

      await client.execute({
        sql: `INSERT INTO "EnquiryHistoryEvent" (
          id, enquiryId, eventType, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?)`,
        args: [
          `evt_turso_${Date.now()}_${i + 1}`,
          id,
          'ingested',
          'Initial ingestion and LLM extraction complete on Turso',
          nowStr,
        ],
      })

      successCount++
      console.log(`    ✅ Created Enquiry ID: ${id} (${extracted.company || extracted.contactName || 'Unregistered'})`)
    } catch (err: any) {
      console.error(`    ❌ Failed item #${i + 1}: ${err.message}`)
    }
  }

  console.log(`\n🎉 Turso Database Seeding Complete! Successfully inserted ${successCount}/${blocks.length} enquiries into Turso Cloud DB.`)
}

setupAndSeedTurso().catch(console.error).finally(() => process.exit(0))
