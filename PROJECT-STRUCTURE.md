# Project Structure & Architecture Map

This guide gives a quick, plain-English overview of how the **Sodio Enquiry Triage Tool** is organized. If you are reviewing this project for the first time, read this file to understand where everything lives before diving into code.

---

## 1. Frontend (what the user sees)

All user interface code is built with Next.js 14 App Router, TypeScript, and Tailwind CSS.

- **`src/app/layout.tsx`**
  - *What lives here:* The root page layout shell, containing the top navigation bar, Sodio branding, and environment status badges.
  - *Why open this:* To edit global headers, footers, dark theme wraps, or font configurations.

- **`src/app/globals.css`**
  - *What lives here:* The single global CSS stylesheet with Tailwind directives, dark theme tokens, scrollbar rules, and glassmorphism styling.
  - *Why open this:* To adjust global UI colors, animations, or styling utilities.

- **`src/app/page.tsx`**
  - *What lives here:* The main Triage Console dashboard page (list view, search, combinable filters, sorting, bulk actions, and batch file upload modal).
  - *Why open this:* To review or modify how enquiries are listed, filtered, sorted, or ingested in bulk.

- **`src/app/enquiries/[id]/page.tsx`**
  - *What lives here:* The detail view page for a single enquiry, featuring a split pane (untouched raw source text on the left, structured editable fields on the right).
  - *Why open this:* To inspect how raw text is compared against extracted fields, how inline edits work, or how AI re-extraction diff suggestions are displayed.

- **`src/lib/utils.ts`**
  - *What lives here:* Formatting helpers for USD currency, dates, CSS class merging, and priority/service color themes.
  - *Why open this:* To change badge color schemes or date/currency formatters.

---

## 2. Backend (the API and database)

All backend endpoints live under `src/app/api/` as Next.js API route handlers, interacting directly with SQLite via Prisma ORM.

- **`prisma/schema.prisma`**
  - *What lives here:* The SQLite database schema definition, specifying the `Enquiry` table, extracted fields, priority/status enums, and JSON edit-tracking columns.
  - *Why open this:* To inspect or alter database model fields and database provider configurations.

- **`prisma/seed.ts`**
  - *What lives here:* The database seeding script that ingests `sample-enquiries.txt`, parses it, runs extraction and scoring, and populates SQLite.
  - *Why open this:* To run or customize initial database setup and sample loading.

- **`src/lib/db.ts`**
  - *What lives here:* A singleton PrismaClient database instance manager.
  - *Why open this:* To check or modify how database connections are pooled in Next.js development.

- **`src/lib/parsing.ts`**
  - *What lives here:* The raw text file parser that splits uploaded batch files or text strings into individual enquiry blocks using dashed line separators (`---`).
  - *Why open this:* To adjust file splitting logic or multi-item text delimiter rules.

- **`src/app/api/enquiries/route.ts`**
  - *What lives here:* API endpoint for listing enquiries (with multi-field search, status/priority/service filtering, and sorting) and manually creating a new enquiry.
  - *Why open this:* To inspect query filtering or single-item creation endpoints.

- **`src/app/api/enquiries/[id]/route.ts`**
  - *What lives here:* API endpoint to fetch (`GET`), inline edit (`PUT`), or delete (`DELETE`) a single enquiry record. Tracks human-edited fields automatically.
  - *Why open this:* To see how human edits are recorded and protected.

- **`src/app/api/enquiries/[id]/re-extract/route.ts`**
  - *What lives here:* API endpoint that re-runs LLM extraction on an enquiry's raw text while preserving human-edited fields and saving a prior snapshot.
  - *Why open this:* To inspect the non-destructive re-extraction and AI recommendation diff engine.

- **`src/app/api/enquiries/batch/route.ts`**
  - *What lives here:* API endpoint for batch uploading enquiry files with bounded concurrency (`p-limit`) and per-item failure handling.
  - *Why open this:* To see how concurrency, rate limits, and partial failures are managed during bulk processing.

---

## 3. The two "smart" parts (extraction + scoring)

These two files contain the core business logic and AI analysis engine for the entire application.

- **`src/lib/llm/extractor.ts`**
  - *What lives here:* The LLM extraction module that connects to Claude via `@anthropic-ai/sdk` (or uses a graceful local fallback stub when no key is set). Parses untrusted raw text into structured JSON metadata.
  - *Why open this:* To review the Anthropic system prompts, prompt injection defense rules, currency/lakh normalizers, and fallback mechanisms.

- **`src/lib/scoring.ts`**
  - *What lives here:* The pure, deterministic priority scoring function (`computePriority`). Evaluates budget size, timeline urgency, contact completeness, non-genuine flags, and prompt injection attempts in application code without LLM hallucination risk.
  - *Why open this:* To inspect or test the mathematical logic behind assigning `high`, `medium`, or `low` priority scores.
