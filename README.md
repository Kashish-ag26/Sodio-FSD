# Sodio Enquiry Triage Console

An internal AI-assisted triage tool for software agency project enquiries. Ingests unstructured messages, extracts structured fields using Claude (via `@anthropic-ai/sdk` or OpenRouter API), scores priority deterministically in application code, and provides an interactive console for editing and tracking enquiries.

---

## Run it

Follow these step-by-step commands to set up and run the application locally. Only Node.js (v18+) is required.

### 1. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
In `.env`, set your Anthropic or OpenRouter API Key:
```env
ANTHROPIC_API_KEY=your_anthropic_or_openrouter_api_key
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

### 4. Seed Database with 21 Messy Sample Enquiries
Ingest and process the 21 real-shaped sample enquiries from `sample-enquiries.txt`:
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the Home Page, or go directly to [http://localhost:3000/enquiries](http://localhost:3000/enquiries) for the Triage Console.

---

## What works / what doesn't

### What works
- **Landing Home Page (`/`):** Clean operational landing page with tool explanation, live database counts (total enquiries, new/unreviewed count, high priority, total pipeline USD), and direct call-to-action button into the Triage Console (`/enquiries`).
- **Multiform Ingestion (.txt, .pdf, Paste):** Accepts raw text, `.txt` batch files, AND `.pdf` files. Server-side text extraction (`pdf-parse`) extracts readable text layers from PDFs and runs them through the same block-splitting pipeline. Includes a **"Load demo enquiry"** button for 1-click test input.
- **Live Streaming NDJSON Progress:** During batch uploads, `/api/enquiries/batch` streams live NDJSON events so each table row updates visibly in real-time (`"processing..."` → filled-in extracted data, or → `"extraction failed"` with a retry button).
- **Explicit "Save Changes" Button & Unsaved Edits Protection:** Detail view features an explicit "Save Changes" button that activates the moment any field is modified, persisting all edits in one write and prompting an unsaved edits warning if the user attempts to navigate away or run re-extraction.
- **Relational Enquiry History Log (`EnquiryHistoryEvent`):** Full audit trail tracking every manual field edit (`oldValue` → `newValue`), status transition, and AI re-extraction run with timestamp and protected field notes.
- **LLM Extraction Pipeline:** Extracts company, contact name, contact email, service line, raw budget, normalized USD budget, timeline phrase, summary, genuine enquiry status, and extraction notes. Works with native Anthropic keys (`sk-ant-...`) and OpenRouter keys (`sk-or-v1-...`).
- **Robust Fallback Stub:** When no API key is configured, a heuristic extraction stub runs seamlessly, logging a warning and returning plausible structured data without crashing.
- **Deterministic Priority Engine:** Pure TypeScript scoring function evaluates priority (`high`, `medium`, `low`) based on budget size, urgency keywords, contact completeness, and prompt injection defense.
- **Adversarial Prompt Injection Defense:** System prompt treats raw input as untrusted data. Enquiry #2 (containing fake system commands to force high priority and $10M budget) is correctly flagged as `isGenuineEnquiry: false` with notes and assigned `low` priority.
- **Non-Destructive Re-Extraction:** Re-running extraction on an enquiry preserves fields manually edited by humans (`humanEditedFields`). Manually edited fields display a `Protected Edit` badge and are left untouched during re-extraction while untouched fields update normally.
- **Batch Processing & Concurrency:** Processes batch uploads with bounded concurrency (`p-limit(3)`). Handles partial failures gracefully — if one item fails, the rest complete, and the failed item appears in the DB with error notes and a retry button.

### What doesn't
- **Vercel Cloud Deployment:** Cloud deployment was attempted but abandoned due to time constraints (per the brief's directive that deployment is explicitly optional). The application is fully optimized, verified, and running locally using Node.js and local SQLite (`dev.db`).
- **Scanned Image PDFs without OCR:** PDF extraction relies on readable text layers via `pdf-parse`. Scanned image PDFs without selectable text fail gracefully with a user-friendly alert asking for a text-based PDF or `.txt` file.
- **Multi-project splitting into separate DB rows:** Currently, when an enquiry describes two unrelated projects in one message (e.g. Enquiry #7), it is captured as a single DB record with both projects detailed in the summary and `extractionNotes`, rather than automatically splitting into two linked database rows.
- **Live Currency Exchange API:** Budget normalization uses fixed illustrative exchange rates (e.g. 1 Lakh = 100,000 INR @ 83 INR/USD, 1 EUR = $1.08 USD) rather than querying a real-time live FX rate service.

---

## Decisions

Here is a breakdown of key architectural decisions made on edge cases:

1. **PDF File Support (.pdf):**
   - *Decision:* Use `pdf-parse` on the server to convert uploaded PDF Buffers to plain text, then pass that text into the exact same block-splitting (`parseEnquiriesFile`) and LLM extraction pipeline as `.txt` files.
   - *Reasoning:* Reuses 100% of existing extraction, prompt injection defense, and scoring logic without creating duplicate parallel code paths.

2. **Prompt Injection Attempt (Enquiry #2):**
   - *Decision:* Treat the entire text as untrusted data. System prompt explicitly instructs the LLM to identify embedded system notices. When detected, set `isGenuineEnquiry: false` and note `"Prompt injection attempt detected"`.
   - *Reasoning:* Never allow raw user input to override triage rules or scoring. The deterministic scoring function checks for injection notes and forces priority to `low`.

3. **Duplicate Senders (Enquiries #8 & #9):**
   - *Decision:* Ingest both emails as separate database records, but flag the second enquiry in `extractionNotes` as `"Possible duplicate follow-up from alex@nexuscore.io"`.
   - *Reasoning:* Automatically merging rows could lose distinct timeline messages or human edits. Keeping them as separate rows with visible flags gives human operators full control.

4. **Multi-Project Enquiries (Enquiry #7):**
   - *Decision:* Keep as a single enquiry record, but summarize both initiatives in `summary` and explicitly list both scopes in `extractionNotes`.
   - *Reasoning:* Creating multiple DB records from a single customer form submission creates confusion without explicit user confirmation. Capturing both in notes provides complete visibility.

5. **Non-Enquiries (Spam, Recruiting, Bounces - Enquiries #3, #4, #5):**
   - *Decision:* Mark `isGenuineEnquiry: false` and assign `low` priority automatically.
   - *Reasoning:* Spam and job applications should not take attention away from prospective clients, but should remain visible in the console so humans can dismiss or review them.

---

## Re-extraction

### How it works
1. **Explicit Save Button:** Manual edits made on the detail view are saved explicitly via the "Save Changes" button, updating the record in SQLite and tagging modified field names in `humanEditedFields`.
2. **Re-Extraction Run:** When a user clicks **Re-run Extraction**, the system fetches the untouched `rawText` and runs a fresh LLM extraction.
3. **Audit Snapshot:** A JSON snapshot of the state prior to re-extraction is saved in `previousExtraction`.
4. **Edit Protection:** The system checks `humanEditedFields`:
   - For fields **not** in `humanEditedFields`, the database is updated with the new AI values.
   - For fields **in** `humanEditedFields`, the human's value is **preserved** on the record and left untouched, with a visible `Protected Edit` badge on the UI.
5. **Audit History Log:** Every manual edit and re-extraction event is recorded in the **Enquiry Audit History Log** (`EnquiryHistoryEvent`).
6. **Priority Re-scoring:** Priority is automatically re-computed based on the effective values (unless priority itself was manually overridden).

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

---

## Two more days

With two additional days, I would prioritize:
1. **OCR Support for Scanned PDFs:** Integrate Tesseract OCR for scanned image PDFs.
2. **Automated Unit & Integration Tests:** Add Vitest test suites for `scoring.ts`, `parsing.ts`, and LLM prompt injection test cases.
3. **Multi-Project Splitter Tool:** Add an interactive modal UI when a multi-project enquiry is detected, allowing operators to click "Split into 2 Enquiries" with one click.
