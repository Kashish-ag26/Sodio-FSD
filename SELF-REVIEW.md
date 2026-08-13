# Self-Review (Senior Engineer Critique)

If a Senior Staff Engineer reviewed this codebase line-by-line, here are three blunt, unhedged weaknesses they would flag:

---

## 1. Single-Table JSON Column Anti-Pattern for Audit Snapshots and Edits
- **Critique:** `humanEditedFields` and `previousExtraction` are stored as stringified JSON blobs (`String`) directly inside the main `Enquiry` table in SQLite rather than using a dedicated `EnquiryFieldEdit` audit log table or relational schema.
- **Why it's a weakness:** As the system scales, querying or filtering enquiries based on which specific fields were edited by humans requires string parsing or client-side deserialization. A relational audit log table with foreign keys (`enquiry_id`, `field_name`, `old_value`, `new_value`, `edited_by`, `edited_at`) would provide far superior query capability, historical auditability, and indexing.

---

## 2. In-Memory Array Sorting for Custom Priority Ranks
- **Critique:** In `/api/enquiries/route.ts`, sorting by `priority` performs an in-memory `Array.prototype.sort()` after pulling all matching rows from SQLite, rather than relying on database index ordering or SQL `CASE` statements.
- **Why it's a weakness:** If the table grows from 20 rows to 100,000 enquiries, fetching all records into Node.js memory to sort by priority custom weights (`high` -> `medium` -> `low`) will cause significant memory usage and latency degradation. Priority should be backed by an indexed integer column (e.g. `priorityRank`: 3 for high, 2 for medium, 1 for low) sorted directly in SQL.

---

## 3. Absence of Transaction Locks During Batch Ingestion and Re-extraction
- **Critique:** Batch ingestion (`/api/enquiries/batch/route.ts`) and re-extraction (`/api/enquiries/[id]/re-extract/route.ts`) perform multi-step read-then-write operations without Prisma `$transaction` blocks or optimistic concurrency locking.
- **Why it's a weakness:** If two operators simultaneously click "Re-run Extraction" or perform an inline edit on the same enquiry at the exact same millisecond, race conditions could cause lost updates or inconsistent snapshot history. Wrapping state updates in `$transaction` with optimistic locking (`version` field) is required for true production concurrency safety.
