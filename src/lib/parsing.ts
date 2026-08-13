/**
 * Utility to parse uploaded sample enquiries text file into individual raw enquiry blocks.
 * Splits on lines that consist of dashed separators (e.g., '---', '----------------------------------------').
 */
export function parseEnquiriesFile(fileContent: string): string[] {
  if (!fileContent || !fileContent.trim()) {
    return []
  }

  // Split on separator lines containing 3 or more dashes
  const blocks = fileContent.split(/\n\s*-{3,}\s*\n/)

  return blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
}
