import { createRequire } from 'module'

/**
 * Robustly resolve the callable pdf-parse function across Next.js CJS/ESM Webpack bundlers.
 */
function getPdfParser(): (buffer: Buffer) => Promise<{ text: string; numpages: number }> {
  try {
    const customRequire = createRequire(import.meta.url)
    try {
      const pdfLib = customRequire('pdf-parse/lib/pdf-parse.js')
      if (typeof pdfLib === 'function') return pdfLib
    } catch (e) {}

    const pdfMain = customRequire('pdf-parse')
    if (typeof pdfMain === 'function') return pdfMain
    if (typeof pdfMain?.default === 'function') return pdfMain.default
  } catch (e) {}

  try {
    const pdfLib = require('pdf-parse/lib/pdf-parse.js')
    if (typeof pdfLib === 'function') return pdfLib
  } catch (e) {}

  const pdfMain = require('pdf-parse')
  if (typeof pdfMain === 'function') return pdfMain
  if (typeof pdfMain?.default === 'function') return pdfMain.default

  return pdfMain
}

/**
 * Utility to parse uploaded sample enquiries text file into individual raw enquiry blocks.
 * Splits on lines that consist of dashed separators (e.g., '---', '----------------------------------------').
 * Handles both Windows (\r\n) and Unix (\n) line endings cleanly.
 */
export function parseEnquiriesFile(fileContent: string): string[] {
  if (!fileContent || !fileContent.trim()) {
    console.warn('[parsing.ts] Empty file content passed to parser.')
    return []
  }

  console.log(`[parsing.ts] Raw text length: ${fileContent.length} chars.`)

  // Split on separator lines containing 3 or more dashes, accounting for CRLF and LF
  const blocks = fileContent.split(/(?:\r?\n|^)\s*-{3,}\s*(?:\r?\n|$)/)

  const cleanedBlocks = blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)

  console.log(`[parsing.ts] Split text into ${cleanedBlocks.length} individual raw enquiry blocks.`)
  
  cleanedBlocks.slice(0, 3).forEach((block, idx) => {
    console.log(`[parsing.ts] Block #${idx + 1} preview (first 100 chars): "${block.substring(0, 100).replace(/\r?\n/g, ' ')}..."`)
  })

  return cleanedBlocks
}

/**
 * Server-side PDF text extraction using pdf-parse.
 * Safely handles ESM/CJS interop so pdfParse is guaranteed to be a callable function.
 * Fails gracefully if the PDF is scanned / empty / contains no text layer.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const parseFn = getPdfParser()

    if (typeof parseFn !== 'function') {
      throw new Error(`pdfParse interop resolution failed: expected function but got ${typeof parseFn}`)
    }

    const data = await parseFn(buffer)
    const extractedText = data && data.text ? data.text.trim() : ''

    if (!extractedText) {
      throw new Error('PDF contains no readable text layer (may be a scanned image). Please use a text-based PDF or .txt file.')
    }

    console.log(`[parsing.ts] Successfully extracted ${extractedText.length} chars from PDF file (${data.numpages || 1} pages).`)
    return extractedText
  } catch (error: any) {
    console.error('[parsing.ts] PDF Text Extraction Error:', error)
    throw new Error(`PDF parsing failed: ${error.message || String(error)}`)
  }
}
