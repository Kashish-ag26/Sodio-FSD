# Sodio Enquiry Triage Console

An internal AI-assisted triage tool for software agency project enquiries. Ingests unstructured messages, extracts structured fields using Claude (via `@anthropic-ai/sdk`), scores priority deterministically in application code, and provides an interactive console for editing and tracking enquiries.

---

## Run it

Follow these step-by-step commands to set up and run the application locally. Only Node.js (v18+) is required.

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
In `.env`, set your Anthropic API Key:
```env
ANTHROPIC_API_KEY=your_actual_anthropic_api_key
DATABASE_URL="file:./dev.db"
```
*(Note: If `ANTHROPIC_API_KEY` is omitted or left as default, the application will automatically run using a clearly labeled fallback stub implementation so the app never crashes or hangs).*

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Database & Push Schema
Sync the SQLite database schema with Prisma:
```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Database with 20 Messy Sample Enquiries
Ingest and process the 20 real-shaped sample enquiries from `sample-enquiries.txt`:
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the console.

---

## What works / what doesn't

### What works
- **Unstructured Ingestion:** Upload batch files (e.g. `sample-enquiries.txt`) or paste multi-block raw text. File splitter correctly parses blocks separated by dashed lines (`---`).
- **LLM Extraction Pipeline:** Extracts company, contact name, contact email, service line, raw budget, normalized USD budget, timeline phrase, summary, genuine enquiry status, and extraction notes. Uses structured JSON extraction with Claude 3.5 Sonnet.
- **Robust Fallback Stub:** When no Anthropic API key is configured, a heuristic extraction stub runs seamlessly, logging a warning and returning plausible structured data without crashing.
- **Deterministic Priority Engine:** Pure TypeScript scoring function evaluates priority (`high`, `medium`, `low`) based on budget size, urgency keywords, contact completeness, and prompt injection defense.
- **Adversarial Prompt Injection Defense:** System prompt treats raw input as untrusted data. Enquiry #2 (containing fake system commands to force high priority and $10M budget) is correctly flagged as `isGenuineEnquiry: false` with notes and assigned `low` priority.
- **Non-Destructive Re-Extraction:** Re-running extraction on an enquiry preserves fields manually edited by humans (`humanEditedFields`). Displays AI suggestions alongside human fields so users can accept or reject new AI values.
- **Batch Processing & Concurrency:** Processes batch uploads with bounded concurrency (`p-limit(3)`). Handles partial failures gracefully — if one item fails, the rest complete, and the failed item appears in the DB with error notes and a retry button.
- **Interactive UI Console:** Search bar, combinable filters (Service Line, Priority, Status), sorting (Date, Priority, Budget), inline status workflow dropdown, and a detail view comparing untouched raw text against extracted fields.

### What doesn't
- **Multi-project splitting into separate DB rows:** Currently, when an enquiry describes two unrelated projects in one message (e.g. Enquiry #7), it is captured as a single DB record with both projects detailed in the summary and `extractionNotes`, rather than automatically splitting into two linked database rows.
- **Live Currency Exchange API:** Budget normalization uses fixed illustrative exchange rates (e.g. 1 Lakh = 100,000 INR @ 83 INR/USD, 1 EUR = $1.08 USD) rather than querying a real-time live FX rate service.
- **Real-Time WebSockets / SSE for Batch:** Batch progress modal uses live step updates in API polling rather than SSE or WebSocket push channels.

---

## Decisions

Here is a breakdown of key architectural decisions made on edge cases:

1. **Prompt Injection Attempt (Enquiry #2):**
   - *Decision:* Treat the entire text as untrusted data. System prompt explicitly instructs the LLM to identify embedded system notices. When detected, set `isGenuineEnquiry: false` and note `"Prompt injection attempt detected"`.
   - *Reasoning:* Never allow raw user input to override triage rules or scoring. The deterministic scoring function checks for injection notes and forces priority to `low`.

2. **Duplicate Senders (Enquiries #8 & #9):**
   - *Decision:* Ingest both emails as separate database records, but flag the second enquiry in `extractionNotes` as `"Possible duplicate follow-up from alex@nexuscore.io"`.
   - *Reasoning:* Automatically merging rows could lose distinct timeline messages or human edits. Keeping them as separate rows with visible flags gives human operators full control.

3. **Multi-Project Enquiries (Enquiry #7):**
   - *Decision:* Keep as a single enquiry record, but summarize both initiatives in `summary` and explicitly list both scopes in `extractionNotes`.
   - *Reasoning:* Creating multiple DB records from a single customer form submission creates confusion without explicit user confirmation. Capturing both in notes provides complete visibility.

4. **Non-Enquiries (Spam, Recruiting, Bounces - Enquiries #3, #4, #5):**
   - *Decision:* Mark `isGenuineEnquiry: false` and assign `low` priority automatically.
   - *Reasoning:* Spam and job applications should not take attention away from prospective clients, but should remain visible in the console so humans can dismiss or review them.

5. **Budget Normalization Formats:**
   - *Decision:* Retain `budgetRaw` verbatim (e.g., `"35-40 lakhs"`, `"€50,000"`). Best-effort convert to `budgetNormalized` (approximate USD integer) for sorting. For unquantifiable budgets (`"flexible"`, `"TBD"`), store `null`.
   - *Reasoning:* Preserves exact client phrasing for humans while enabling numeric sorting across international currencies.

6. **Timeline Interpretation:**
   - *Decision:* Store the raw timeline phrase as written (e.g. `"ASAP"`, `"Q1 next year"`).
   - *Reasoning:* Forcing dates onto vague phrases like "ASAP" or "Q1" creates misleading precision. Instead, timeline urgency keywords feed into priority scoring.

---

## Re-extraction

### How it works
1. When a user clicks **Re-run Extraction**, the system fetches the untouched `rawText`.
2. A JSON snapshot of the current state is stored in `previousExtraction` to ensure auditability and non-destructive operations.
3. The LLM re-extracts structured fields.
4. The system checks `humanEditedFields` (an array of field names edited by a human).
   - For fields **not** in `humanEditedFields`, the database is updated with the new AI values.
   - For fields **in** `humanEditedFields`, the human's value is **preserved** on the record, while the new AI value is returned as `aiSuggestions`.
5. The UI presents an **"Accept AI Suggestion"** button next to human-edited fields, allowing the user to inspect the AI suggestion and choose whether to adopt it.
6. Priority is automatically re-computed based on the updated fields (unless priority itself was manually overridden by a human).

### What I'd do differently with more time
- Add a visual field-by-field side-by-side diff viewer highlighting exact text differences between extraction v1 and extraction v2.
- Store a historical log table (`EnquiryAuditLog`) to track every revision across time rather than just a single previous snapshot.

---

## Scoring rule

Priority is computed deterministically in application code via `computePriority(extracted: ExtractionResult)` in `src/lib/scoring.ts`:

```typescript
// Score Calculation:
1. Non-genuine enquiries (isGenuineEnquiry === false) -> ALWAYS 'low'
2. Prompt injection flags in notes -> ALWAYS 'low'
3. Budget (Normalized USD):
   - >= $100,000 -> +3 points
   - >= $50,000  -> +2 points
   - >= $10,000  -> +1 point
4. Timeline Urgency:
   - Urgent ("ASAP", "today", "immediate", "down since", "critical", "this week") -> +3 points
   - Moderate ("next month", "Q1", "Q2", "within 30 days", "soon") -> +1 point
5. Contact Completeness:
   - Missing both name and email -> -2 points
   - Missing email -> -1 point

Thresholds:
- Total Score >= 5 -> 'high'
- Total Score >= 2 -> 'medium'
- Otherwise          -> 'low'
```

### Threshold Reasoning
- **High Priority (Score >= 5):** Requires either a large budget (+$3) plus urgent timeline (+$3), or enterprise budget (+$3) with complete contact info.
- **Medium Priority (Score 2-4):** Moderate budget ($10k-$50k) or urgent timeline with average budget.
- **Low Priority (Score < 2):** Low budget (<$10k), vague timelines, incomplete contact info, spam, or injection attempts.

---

## Two more days

With two additional days, I would prioritize:
1. **Server-Sent Events (SSE) for Batch Progress:** Replace batch polling with real-time SSE progress streaming for live item-by-item table row insertion during batch ingestion.
2. **Automated Unit & Integration Tests:** Add Jest/Vitest test suites for `scoring.ts`, `parsing.ts`, and LLM prompt injection test cases.
3. **Multi-Project Splitter Tool:** Add an interactive modal UI when a multi-project enquiry is detected, allowing operators to click "Split into 2 Enquiries" with one click.
4. **Export & Webhook Integrations:** Add CSV/JSON export and outbound Slack/HubSpot webhooks when an enquiry is marked `high` priority or `qualified`.
