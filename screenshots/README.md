# UI Console Screenshots & Visual Demos

This directory contains visual captures and diagrams demonstrating the key user workflows of the **Sodio Enquiry Triage Console**.

---

### Captured Screenshots

1. **`01_list_view_console.svg`**
   - **Feature Shown:** Main Triage Dashboard console with summary stats cards (Total Enquiries, High Priority, Genuine Projects, Normalized Pipeline USD), combinable search & filter toolbar (Service Line, Priority, Status, Sort), color-coded badges, and inline status workflow selectors.

2. **`02_detail_view_prompt_injection.svg`**
   - **Feature Shown:** Detail View (`/enquiries/[id]`) for Enquiry #2 (the adversarial prompt injection attempt). Shows the red security banner ("Adversarial Prompt Injection Attempt Flagged"), untouched raw source text on the left, extracted structured fields on the right, and low priority assignment.

3. **`03_batch_upload_in_progress.svg`**
   - **Feature Shown:** Batch Ingestion Modal and progress overlay performing bounded concurrent extraction (`p-limit(3)`) over 20 messy sample enquiries.

4. **`04_inline_editing_re_extraction.svg`**
   - **Feature Shown:** Non-destructive re-extraction and human edit protection. Shows the "Edited by human" visual indicator pill on modified fields alongside the "Accept AI Suggestion" recommendation callout.
