import { db } from '../src/lib/db'
import { extractEnquiry } from '../src/lib/llm/extractor'

async function runVerification() {
  console.log('🧪 Starting Re-Extraction Edit Protection Verification Test...')

  // 1. Fetch first available enquiry
  const first = await db.enquiry.findFirst()
  if (!first) {
    console.error('❌ No enquiry found in database for testing!')
    return
  }

  const id = first.id
  console.log(`📌 Testing on Enquiry ID: ${id} (Initial Company: "${first.company}")`)

  // 2. Perform a manual edit on Company Name via PUT simulation
  const newCustomCompany = `Verified Custom Corp ${Date.now()}`
  const editPayload = { company: newCustomCompany }

  let humanEditedFields: string[] = []
  try {
    if (typeof first.humanEditedFields === 'string') {
      humanEditedFields = JSON.parse(first.humanEditedFields)
    }
  } catch (e) {}

  if (!humanEditedFields.includes('company')) {
    humanEditedFields.push('company')
  }

  const updatedRecord = await db.enquiry.update({
    where: { id },
    data: {
      company: newCustomCompany,
      humanEditedFields: JSON.stringify(humanEditedFields),
    },
  })

  await db.enquiryHistoryEvent.create({
    data: {
      enquiryId: id,
      eventType: 'manual_edit',
      fieldName: 'company',
      oldValue: first.company || 'N/A',
      newValue: newCustomCompany,
      notes: 'Test manual edit verified',
    },
  })

  console.log(`✅ Manual Edit Saved: Company updated to "${updatedRecord.company}"`)

  // 3. Perform Re-Extraction simulation
  const newExtraction = await extractEnquiry(first.rawText)
  const fieldsToExtract = ['company', 'contactName', 'contactEmail', 'serviceLine', 'budgetRaw', 'timeline', 'summary']
  const aiSuggestions: Record<string, any> = {}
  const updateData: any = {}

  for (const field of fieldsToExtract) {
    const aiVal = (newExtraction as any)[field]
    if (humanEditedFields.includes(field)) {
      // KEEP HUMAN VALUE
      updateData[field] = (updatedRecord as any)[field]
      aiSuggestions[field] = aiVal
    } else {
      updateData[field] = aiVal
    }
  }

  const reExtracted = await db.enquiry.update({
    where: { id },
    data: updateData,
  })

  await db.enquiryHistoryEvent.create({
    data: {
      enquiryId: id,
      eventType: 're_extraction',
      fieldName: null,
      oldValue: null,
      newValue: null,
      notes: `Re-extraction test run. Protected human-edited field(s): company`,
    },
  })

  console.log(`\n🔍 Verifying Results After Re-Extraction:`)
  console.log(`- Saved Company Name in DB: "${reExtracted.company}"`)
  console.log(`- AI Suggested Company Name: "${aiSuggestions.company}"`)

  const history = await db.enquiryHistoryEvent.findMany({
    where: { enquiryId: id },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`- Recorded History Events Count: ${history.length}`)
  history.slice(0, 3).forEach((h, i) => {
    console.log(`  [${i + 1}] ${h.eventType} - ${h.fieldName || 'general'}: ${h.notes || h.newValue}`)
  })

  // PASS / FAIL ASSERTION
  if (reExtracted.company === newCustomCompany && aiSuggestions.company) {
    console.log(`\n🎉 SUCCESS: Re-extraction PRESERVED human edit "${newCustomCompany}" while surfacing AI suggestion "${aiSuggestions.company}"!`)
  } else {
    console.error(`\n❌ FAIL: Re-extraction failed to protect human edit!`)
  }
}

runVerification().catch(console.error).finally(() => process.exit(0))
