import pdfParse from 'pdf-parse'

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
 * Fails gracefully if the PDF is scanned / empty / contains no text layer.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer)
    const extractedText = data.text ? data.text.trim() : ''

    if (!extractedText) {
      throw new Error('PDF contains no readable text layer (may be a scanned image). Please use a text-based PDF or .txt file.')
    }

    console.log(`[parsing.ts] Successfully extracted ${extractedText.length} chars from PDF file (${data.numpages} pages).`)
    return extractedText
  } catch (error: any) {
    console.error('[parsing.ts] PDF Text Extraction Error:', error)
    throw new Error(`PDF parsing failed: ${error.message || String(error)}`)
  }
}
