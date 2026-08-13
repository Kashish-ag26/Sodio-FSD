import { ExtractionResult, Priority } from '@/types/enquiry'

/**
 * Deterministic Priority Scoring Function
 *
 * Rules:
 * 1. Non-genuine enquiries (spam, recruiting, bounce messages, injection attempts) ALWAYS score 'low'.
 * 2. Injection attempts flag in extractionNotes ALWAYS score 'low'.
 * 3. Normalized Budget (USD):
 *    - >= $100,000 -> +3 points
 *    - >= $50,000  -> +2 points
 *    - >= $10,000  -> +1 point
 * 4. Timeline Urgency:
 *    - Urgent ("ASAP", "today", "immediate", "down since", "critical", "this week") -> +3 points
 *    - Moderate ("next month", "Q1", "Q2", "within 30 days", "soon") -> +1 point
 * 5. Contact Completeness:
 *    - Missing both contactName and contactEmail -> -2 points
 *    - Missing contactEmail -> -1 point
 *
 * Priority Mapping:
 * - Total Score >= 5 -> 'high'
 * - Total Score >= 2 -> 'medium'
 * - Otherwise          -> 'low'
 */
export function computePriority(
  extracted: Partial<ExtractionResult>
): Priority {
  // Rule 1: Non-genuine enquiries are forced to 'low'
  if (extracted.isGenuineEnquiry === false) {
    return 'low'
  }

  // Rule 2: Injection attempt defense
  const notes = (extracted.extractionNotes || '').toLowerCase()
  if (
    notes.includes('injection') ||
    notes.includes('system notice') ||
    notes.includes('adversarial') ||
    notes.includes('untrusted')
  ) {
    return 'low'
  }

  let score = 0

  // Rule 3: Budget scoring (normalized USD)
  const budget = extracted.budgetNormalized
  if (typeof budget === 'number' && !isNaN(budget)) {
    if (budget >= 100000) {
      score += 3
    } else if (budget >= 50000) {
      score += 2
    } else if (budget >= 10000) {
      score += 1
    }
  }

  // Rule 4: Timeline urgency
  const timeline = (extracted.timeline || '').toLowerCase()
  if (
    timeline.includes('asap') ||
    timeline.includes('today') ||
    timeline.includes('immediate') ||
    timeline.includes('down since') ||
    timeline.includes('critical') ||
    timeline.includes('this week')
  ) {
    score += 3
  } else if (
    timeline.includes('q1') ||
    timeline.includes('q2') ||
    timeline.includes('next month') ||
    timeline.includes('soon') ||
    timeline.includes('30 days')
  ) {
    score += 1
  }

  // Rule 5: Contact completeness penalty
  const hasName = Boolean(extracted.contactName && extracted.contactName.trim())
  const hasEmail = Boolean(extracted.contactEmail && extracted.contactEmail.trim())

  if (!hasName && !hasEmail) {
    score -= 2
  } else if (!hasEmail) {
    score -= 1
  }

  // Final score mapping
  if (score >= 5) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}