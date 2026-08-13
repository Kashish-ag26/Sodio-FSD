# AI Usage Log & Iteration Commentary

This document details the AI tools used during the construction of the **Sodio Enquiry Triage Console**, key design directions given, and **two concrete instances** where AI-generated initial attempts were flawed or unsuitable and had to be diagnosed and corrected.

---

## AI Tooling Setup
- **Primary Coding AI Agent:** Claude Code / Antigravity AI Pair Programmer
- **Foundation LLM:** Claude 3.5 Sonnet / Claude 3 Sonnet via `@anthropic-ai/sdk`
- **Role:** Autonomous pair programming, boilerplate scaffolding, complex regex normalizers, UI styling with Tailwind CSS, and system prompt engineering.

---

## Concrete Missteps & Corrections

### Instance 1: Flawed Prisma Schema & Package Driver Adapter Configuration
- **What the model initially attempted:**
  During initial database scaffolding for Prisma 7 with SQLite, the AI generated a `schema.prisma` file that removed the `url` property from the `datasource db` block and attempted to load connection strings dynamically from `prisma.config.ts`. When `npx prisma db push` was executed, Prisma CLI version 5.22.0 threw a breaking schema validation error (`P1012: Argument "url" is missing in data source block "db"`).
- **What was noticed:**
  Inspecting the terminal logs revealed that while the root `package.json` had locked `@prisma/client` to standard Prisma v5.22.0, the schema config had adopted experimental Prisma 7 configuration conventions, causing a version mismatch breakdown during database sync.
- **What was done about it:**
  I halted execution, updated `prisma/schema.prisma` to explicitly restore `url = env("DATABASE_URL")`, updated `prisma.config.ts`, re-ran `npx prisma generate`, and verified `npx prisma db push` completed cleanly with 0 validation errors.

---

### Instance 2: Destructive Re-Extraction Overwriting Human Edits
- **What the model initially attempted:**
  In the first draft of `/api/enquiries/[id]/re-extract/route.ts`, the AI handler simply extracted fresh fields from the LLM and executed a direct `prisma.enquiry.update()` across all extracted columns.
- **What was noticed:**
  This violated a fundamental requirement in Section 6: *"Re-running extraction on an enquiry must never silently destroy any fields a human has manually corrected."* If a human staff member had corrected a client's company name or budget, running re-extraction would silently overwrite the human correction with the new LLM output.
- **What was done about it:**
  I redesigned the re-extraction pipeline to:
  1. Inspect the `humanEditedFields` JSON column before applying any updates.
  2. Preserve the human's value on the primary database record for any field listed in `humanEditedFields`.
  3. Capture the new LLM extraction as an `aiSuggestions` object in the response payload.
  4. Build an interactive UI callout ("Accept AI Suggestion") on the detail page so humans retain 100% authority while still benefiting from AI re-evaluations.

---

## Summary of Directing Strategy
Using AI as a high-velocity collaborator allowed complete implementation of a complex full-stack Next.js app in record time. However, strict oversight was essential to ensure deterministic application code (like scoring and edit protection) remained isolated from LLM hallucinations.
