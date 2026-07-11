# CA Munim — Application Issues & Review

**Review date:** 2026-07-02
**Reviewed:** Live app (https://ca-munim.vercel.app/), React/Vite frontend source, Supabase database (RLS policies, functions, storage), and the `send-whatsapp` edge function.
**Scope:** Functional bugs, security, data integrity, and code quality. Severity is my assessment of user/business impact.

---

## Critical

### C1. Client upload portal never actually uploads files
**File:** `src/pages/UploadPortal.tsx` (`handleFiles`, `handleSubmit`)
The public upload page (`/upload/:token`) that clients use to send documents to their CA **simulates** an upload with a `setInterval` progress bar and never writes the file anywhere. `handleSubmit` only updates `document_requests.status = 'uploaded'`. There is no `supabase.storage.from('ca-munim-documents').upload(...)` call. Result: the CA sees the request marked "uploaded," but the actual document does not exist. This defeats the core purpose of the document-collection feature. A private storage bucket `ca-munim-documents` exists but is never written to.

### C2. Anyone (unauthenticated) can read every firm's document requests
**Where:** RLS policy `doc_requests_public_token` on `public.document_requests`
The policy grants `SELECT` to role `public` (includes the anonymous key) with the condition `(upload_token IS NOT NULL)`. That is not scoped to a specific token — it exposes **all** document-request rows across **all firms** (client_id, document_type, due_date, upload_token) to anyone with the public anon key. The upload portal only needs to read the single row matching its token. This is a cross-tenant data leak.
**Fix:** scope the public policy to the exact token being requested (e.g., require `upload_token = <requested token>` via a security-definer RPC or a per-token filter), and prefer a narrow lookup rather than an "is not null" predicate.

### C3. Real test-account credentials committed to git
**File:** `src/.env.test` (tracked in commit `84857b6`)
Contains a live-looking `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. Even though `.gitignore` lists `.env.test` at the root, this file lives under `src/` and is committed. Credentials in the repo are a standing exposure.
**Fix:** remove from git history, rotate the account password, and keep test creds only in CI secrets / untracked local files.

---

## High

### H1. Three inconsistent firm-creation paths with conflicting `firms.id` semantics
**Files:** `src/hooks/useAuth.ts` (`signUp`), `src/App.tsx` (`bootstrapMissingRecords`), DB trigger `handle_new_user`
- `useAuth.signUp` inserts a firm with `id: data.user.id` (firm id **equals** auth user id).
- `handle_new_user` (DB trigger) inserts a firm with an **auto-generated UUID** and links via `staff.firm_id`.
- `bootstrapMissingRecords` also inserts with an auto-generated UUID.

`fetchFirmProfileFromSupabase` (`src/data/Settings.ts`) assumes `firms.id = user.id` as its primary query, only falling back to the staff join if that fails. Depending on which path created the account, the firm id means different things. This is fragile and a likely source of "profile not found" / onboarding edge cases.
**Fix:** pick one canonical path (the DB trigger is the right place) and make the client code stop assuming `firm.id === user.id`.

### H2. `bootstrapMissingRecords` firm insert is blocked by RLS and fails silently
**File:** `src/App.tsx`
The `firms` INSERT policy "Allow authenticated users to insert own firm" has `WITH CHECK (auth.uid() = id)`. `bootstrapMissingRecords` inserts a firm with an auto-generated `id` (≠ `auth.uid()`), so the insert is rejected by RLS. The error is swallowed (`catch` only logs), so a user whose signup trigger failed can land in a broken state (no firm, no staff) with no visible error. The recovery path cannot actually recover.
**Fix:** perform bootstrap via a `SECURITY DEFINER` RPC, or align the insert to satisfy the policy.

### H3. Fees Dashboard shows contradictory numbers
**Live app:** `/billing` → Fees Dashboard
The summary cards report **Total Outstanding ₹30,680** and **Overdue Invoices 4**, while the list below says **"No outstanding invoices 🎉"**. The four invoices are all in `Draft` status. The aggregate cards and the list use different definitions of "outstanding" (drafts are counted in one but excluded from the other). Users can't trust either number.
**Fix:** define "outstanding" once (drafts should almost certainly be excluded) and use it consistently for cards, counts, and the list.

### H4. Pending document requests all show "Unknown Client" — NOT REPRODUCIBLE (checked 2026-07-11)
**Live app:** `/documents` → Pending Requests
Originally: every row renders "Unknown Client" instead of the client name — join from `document_requests` to the client name not resolving. Re-checked against the live project: `fetchDocumentRequestsFromSupabase`'s `clients(name)` embed resolves correctly both via a service-role query and via an RLS-authenticated session (signed in as the e2e test user, inserted a temp `document_requests` row, queried through the real anon-key client exactly as the frontend does — `clients.name` came back populated). All 5 live rows have a valid, non-orphaned `client_id`; none are null or dangling. No commit ever tagged `(H4)`, so whatever caused this was likely fixed incidentally by another change (or was a stale observation from the original 2026-07-02 audit) rather than a real fix landing. Leaving this entry rather than deleting it in case it resurfaces — if "Unknown Client" appears again, the first thing to check is whether the specific `document_requests` row in question actually has a `client_id` set (the UI's `?? 'Unknown Client'` fallback is correct/intended for genuinely orphaned rows, so that would be a data problem, not a query bug).

### H5. WhatsApp bulk send ignores the selected template and its variables
**Files:** `src/data/WhatsappApi.ts` (`sendBulkWhatsAppMessages`), `supabase/functions/send-whatsapp/index.ts`
The client always sends `templateName: "hello_world"` regardless of which template the user picked, and the edge function sends a template with **no variable components** — so none of the `{{client_name}}`, `{{due_date}}`, etc. are ever populated. The compiled message is logged to the DB (so the UI looks correct) but the message actually delivered to the client is the generic sandbox "hello_world." This is flagged as a "hackathon sandbox" note in code, but as shipped it means WhatsApp reminders don't contain the real content.
**Fix:** send the approved template name plus a `components`/parameters payload built from the template variables; remove the hardcoded `hello_world`.

### H6. Compliance due-date and penalty rules are hardcoded and several are wrong
**Files:** `src/data/Tasks.ts` (`dueDateRules`), `src/lib/penaltyRules.ts`, `src/lib/indianTaxUtils.ts`
Domain review (2026-07-06) found the hardcoded Indian tax/compliance rules ship stale or incorrect values — for a CA-audience product, wrong statutory dates and penalty amounts are disqualifying, not cosmetic:
- **GSTR-4 due date wrong.** `dueDateRules["GSTR-4"]` and the FY-based due-date calculation both say 30th April. From FY 2024-25 onward it's 30th June (53rd GST Council meeting, CGST Notification 12/2024, 10 Jul 2024) — every generated GSTR-4 task is ~2 months early.
- **GSTR-3B/GSTR-1 late fee cap wrong.** `penaltyRules.ts` caps both at a flat ₹5,000. Actual caps are turnover-slabbed: ₹2,000 up to ₹1.5cr turnover, ₹5,000 for ₹1.5–5cr, ₹10,000 above ₹5cr; nil returns cap at ₹500 (₹20/day). Overstates penalties ~2.5x for small clients (the majority of a typical CA's book) and understates for large ones. No nil-return option exists at all.
- **GSTR-9 late fee wrong.** Flat ₹200/day. From FY 2022-23 (Notification 07/2023) it's turnover-slabbed: ₹50/day (cap 0.04% of turnover) up to ₹5cr, ₹100/day for ₹5–20cr, only ₹200/day (cap 0.50%) above that. Overstates ~4x for most clients.
- **GSTR-3B label is misleading.** "20th of following month (turnover > ₹5cr)" conflates monthly and QRMP filing — QRMP taxpayers (turnover ≤ ₹5cr, opted in) file quarterly by the 22nd/24th depending on state category. The QRMP scheme doesn't exist anywhere in the data model.
- **Advance Tax penalty is fabricated.** The calculation multiplies against a hardcoded `assumedShortfall = 100000` instead of asking the user for the client's actual shortfall — the Section 234B/C output is not derived from real data.
- Verified correct as-is: GSTR-1 (11th), GSTR-9 (31 Dec date itself, only the fee is wrong), CMP-08 (18th), TDS challan (7th / 30 Apr for March), 24Q/26Q, Form 16 (15 June), ITR (31 Jul/31 Oct), advance tax instalment dates, DIR-3 KYC, MGT-7, AOC-4, and the ITR/TDS late-fee sections (234F, 234E).
**Structural point:** even correct rules get amended ad hoc by notification (e.g. GSTR-3B for Mar 2026 moved 20th→21st). Hardcoded frontend constants can never track this — the real fix is a data-driven rules table with effective-date ranges, updatable without a redeploy.
**Correction (2026-07-06, verified against live DB):** this table already exists — `public.compliance_rules` (`due_date_rule`/`late_fee_rule` jsonb, `effective_from`/`effective_to`, `applicable_states`) — with 14 seeded rows, but **nothing in the frontend reads it**; `dueDateRules`/`penaltyRules.ts` remain the only thing actually consulted. The seeded data is itself a mix: due dates for GSTR-1/GSTR-3B (including separate `GSTR-3B_QRMP_CAT1`/`CAT2` rows at 22nd/24th — QRMP *is* modeled here, contrary to the frontend gap) and TDS look correct, but `late_fee_rule` for GSTR-1/GSTR-3B/GSTR-9 is still flat (not turnover-slabbed) and several filing types are missing entirely (GSTR-4, CMP-08, MGT-7, AOC-4, DIR-3 KYC, Form 16, ADT-1, INC-20A, PAS-3). Similarly, `clients.gst_filing_freq` and `clients.gst_turnover_category` already exist — the "QRMP flag" and "turnover slab" data model gap PM review flagged below is largely a **wiring gap**, not a missing-column gap. Fix scope is: (1) complete/correct the seeded rows (add missing filing types, fix late-fee JSON to a turnover-slab shape), (2) build a resolver (rule + client's filing-frequency/turnover-category + as-of date → due date/penalty) and switch every caller to it, (3) delete the hardcoded constants.
**Fixed in stages, tagged `(H6 P1)`–`(H6 P5)`:** P1 corrected the 3 wrong statutory values; P2 built the `compliance_rules` resolver (`src/data/ComplianceRules.ts`) and switched `PenaltyCalculator`/`BulkTaskGenerator` to it; P3/P4 added the reminder scheduler and `services_subscribed`-driven recurrence engine; P5 added the Excel client importer. **QRMP wiring gap closed 2026-07-10:** the above correction's claim that `gst_filing_freq` was "captured in AddClientModal" was itself wrong — the Select existed in the JSX but was never bound to state, so the column was always written empty. Fixed: the Select is now bound and saved, `GSTR-1_QRMP` was added to `compliance_rules` (only the GSTR-3B QRMP rows existed before), `applicable_states` was populated on the CAT1/CAT2 rows, and `generate-recurring-tasks`/`BulkTaskGenerator` now generate quarterly QRMP tasks (correct due date by state category) instead of monthly for clients who opt in. GST turnover-category slabbed late fees and the remaining missing filing types (MGT-7, AOC-4, DIR-3 KYC, Form 16, ADT-1, INC-20A, PAS-3) are still open.
**Turnover-slabbed late fees fixed 2026-07-11 — data bug, not a resolver bug.** Re-checked against the live DB: `computeLateFee`'s turnover-slab scaling for GSTR-1/GSTR-3B (2.5x/5x by slab) was already correct, but the stored `late_fee_rule.max` was `10000` — the >5cr slab's value — instead of `2000`, the base the resolver scales up from. Every filer regardless of turnover was shown the largest slab's cap (a ~5x overstatement for the majority of a typical CA's book), and `nil_max` was never set at all, leaving nil-return penalties uncapped. Fixed by a data-only migration (`20260711170000_h6_gst_late_fee_slab_data.sql`) correcting `max`→2000 and adding `nil_max`→500 on all 5 GSTR-1/GSTR-3B monthly+QRMP rows. GSTR-9 needed an actual code change: its per-day rate (not just the cap) varies by turnover slab, which the old single `per_day`/`max_percentage` shape couldn't represent — added a new `slabs` array shape to `LateFeeRule`/`computeLateFee` and migrated GSTR-9's row to it (≤5cr: ₹50/day capped at 0.04%; 5–20cr: ₹100/day capped at 0.04%; >20cr: ₹200/day capped at 0.50%, per Notification 07/2023-CT). Verified via new unit tests in `ComplianceRules.test.ts` asserting the exact live values, plus a direct DB read confirming the migration landed; did not click through the actual Penalty Calculator UI (would have required signing in, which is outside what this session does on the user's behalf).
**Still open: missing filing types.** Of the list above, `DIR-3 KYC` and `CMP-08` turned out to already exist in `compliance_rules` (the note was stale) — genuinely missing are MGT-7, AOC-4, Form 16, ADT-1, INC-20A, PAS-3. MGT-7/AOC-4/ADT-1 are blocked on a real gap, not just a missing row: their due dates are relative to a company's AGM date, and `clients.agm_due_month` exists as a column but nothing in the UI sets it yet (same blocker `generate-recurring-tasks` already documents for why it excludes them). INC-20A/PAS-3 are one-time, event-based filings (relative to incorporation/allotment date) that don't fit the current FY-relative `due_date_rule` shape at all. Form 16 already has a verified-correct due date (15 June) but it's still only hardcoded, not in the table. This is a larger feature (event-date capture per client) than a rules-table fix and is better scoped as its own follow-up.

---

## Medium

### M1. TypeScript compilation errors in shipped code
`npx tsc --noEmit` reports 5 errors:
- `src/components/dashboard/QuickActions.tsx:86` and `src/pages/Clients.tsx:165` — comparing a `ClientMutationResult` object to a boolean (`=== true`/`=== false`), so the check is always the wrong branch.
- `src/components/tasks/AddTaskModal.tsx:145` — `string` assigned to `TaskPriority`.
- `src/pages/Tasks.tsx:211/214/216` — `documentChecklist` items missing required `id`/`received` fields.

The `ClientMutationResult` comparisons (M1a) are real logic bugs: `addClient`/`updateClient` return `{ success, error }`, and code comparing that object with `=== true` will never take the success branch — success/error toasts and modal-close behavior may be wrong.

### M2. `send-whatsapp` edge function has no auth/authorization or input validation
**File:** `supabase/functions/send-whatsapp/index.ts`
- `Access-Control-Allow-Origin: '*'` — any origin can call it.
- It reads `phoneNumbers` from the body and blindly sends WhatsApp templates to each, with no check that the caller owns those clients (or is even authenticated within the function). `config.toml` sets `verify_jwt = true`, which requires a valid JWT, but the function itself does no per-firm authorization — any authenticated user could send to arbitrary phone numbers, burning the firm's WhatsApp quota / spamming.
- No validation of `phoneNumbers` shape or length (no cap), enabling abuse.
- The result objects returned don't include `phone`, but `WhatsappApi.ts` builds `resultByPhone` keyed on `result.phone` — so status mapping to "sent"/"failed" is effectively broken (always falls to the default).

### M3. Live Meta WhatsApp access token sits in a local `.env`
**File:** `.env` (untracked, but present locally)
A real-looking `WHATSAPP_ACCESS_TOKEN` is in the working tree. It is not in git history (good), but confirm it is only stored as a Supabase function secret in production and rotate it if it has been shared. Long-lived Meta tokens are high-value.

### M4. Document-received flow is in-memory mock only
**File:** `src/lib/taskChecklistStore.ts`
`taskChecklistStore` seeds from `mockTasks` and keeps checklist state in a module-level `Map`. `markReceivedByLabel` (called by the upload portal on submit) mutates this in-memory mock, not the database. So "document received" never persists and resets on reload, and it operates against mock tasks rather than the signed-in firm's real tasks.

### M5. Supabase security advisor warnings
From the Supabase linter:
- `subscription_plans` has RLS enabled but **no policy** → table returns nothing to everyone (or is misconfigured).
- `get_my_firm_id` and `handle_new_user` are `SECURITY DEFINER` with a **mutable `search_path`** — should be pinned (`SET search_path = ''` / explicit schema) to prevent search-path hijacking.
- Leaked-password protection (HaveIBeenPwned) is **disabled** in Auth — enable it.
- Many tables are `SELECT`-exposed to `anon`/`authenticated` in the GraphQL schema; review whether `anon` needs any of them.

### M6. Duplicate firm RLS policies with different logic
`firms` has both the older `auth.uid() = id` policies and the newer `id = get_my_firm_id()` policies simultaneously. Because policies are OR'd, this widens access unpredictably and makes the effective rule hard to reason about. Consolidate to a single scheme.

### M7. No PAN/phone uniqueness or validation on clients
**Live app:** `/clients`
Two clients ("dummy client", "sss") share PAN `ABCDE1234F`; two others share phone `7507327755`. PAN has a fixed legal format and should be unique per firm; there's no validation or dedupe, which will cause confusion and bad reminders.

### M8. `updateClient` silently drops several `ClientFormData` fields — FIXED for `gst_filing_freq` (2026-07-10)
**Files:** `src/hooks/useClients.ts`
`addClient`'s insert and `updateClient`'s `.update({...})` payload were never kept in sync — `addClient` wrote `gst_filing_freq`, `updateClient` didn't. Editing an existing client's GST Filing Frequency (or presumably other fields with the same gap) showed no error and the mutation returned success, but the value silently never persisted. Found and confirmed live: edited a test client, `PATCH .../clients` returned 204, but a direct DB query still showed `gst_filing_freq: null`; fixed by adding it to `updateClient`'s update object, then re-verified the edit-save-reload round trip persists correctly. `mca_filings` has the identical gap and is still open — see spawned follow-up task.

### M9. `invoices` has no real due date — aging/overdue logic is anchored to invoice_date
**Files:** `src/data/Billing.ts` (`dueDate: row.invoice_date`), `src/components/billing/FeesDashboard.tsx`, `src/data/Reports.ts` (`computeReceivablesAging`)
The `invoices` table has no `due_date` column — only `invoice_date` (date) and a free-text `payment_terms` field (values seen live: `null`, `"Due on receipt"`). Every place that needs a due date (`FeesDashboard`'s overdue check, the receivables aging report added 2026-07-10) treats `dueDate` as literally equal to `invoice_date`, so "overdue"/aging is really "days since invoiced," not "days past the agreed payment term." A firm using 15/30/45-day terms will see wrong overdue flags and wrong aging buckets. Real fix: add a `due_date` column to `invoices` (computed at creation time from a structured payment-terms selector — e.g. "Net 15/30/45" dropdown instead of free text — defaulting to `invoice_date` for "due on receipt"), backfill existing rows, and switch every `dueDate` reference off the `invoice_date` proxy. Not done as part of the aging report work since it's a schema change plus an invoice-creation-flow UI change, bigger than "build a report from existing data."

### M10. Client credential vault: reveal has no re-auth step or rate limit — deliberate, revisit if the firm grows
**Files:** `supabase/migrations/20260711080000_client_credential_vault.sql`, `src/components/clients/ClientCredentialsPanel.tsx`
The DSC register + portal-password vault (added 2026-07-11, see the ADR discussed in that session) gates every read/write behind admin role + firm ownership, checked server-side inside `SECURITY DEFINER` RPCs, with every reveal logged to `audit_log`. Two hardening steps were considered and explicitly deferred rather than built: (1) no re-authentication (e.g. re-enter your password) before a reveal — session-based admin auth only; (2) no rate-limiting on reveal calls. Reasoning at the time: reveal is already admin-only, and an admin session can already do arbitrary damage elsewhere in the app (delete invoices, edit any client), so these add friction without a correspondingly large new attack surface closed. Revisit if the firm grows past a handful of staff (more admin accounts = more exposure per compromised credential) or if reveal abuse is ever observed in the audit trail.

### M11. "Apply GST" toggle in Create Invoice only affected the preview, not what was stored — FIXED (2026-07-11)
**Files:** `src/hooks/useBilling.ts` (`createInvoice`), `src/components/billing/CreateInvoiceModal.tsx`
Found while fixing the money-as-floats item below: `CreateInvoiceModal`'s local subtotal/cgst/sgst/igst calculation respected the `gstEnabled` switch, but `useBilling.ts`'s `createInvoice` — the function that actually builds the row sent to `supabase.from('invoices').insert(...)` — computed `gstAmount = subtotal * 0.18` unconditionally, with no reference to the toggle at all. Turning "Apply GST" off in the modal changed what the user saw in the live preview but not what was billed: every invoice was created with 18% GST regardless, silently overcharging clients the toggle was meant to exempt. Fixed by adding `gst_applicable` to `InvoiceFormData` (defaults to `true` so the one other caller's behavior is unchanged) and gating the calculation on it inside `createInvoice`. Confirmed live against the real Supabase project: created one invoice with the toggle off (`igst`/`cgst`/`sgst` all stored as `0`, `total` == `subtotal`) and one with it on (`igst` stored correctly), then deleted both test rows.

### M12. Invoice GST math done in raw JS floats, unrounded, before insert — FIXED (2026-07-11)
**Files:** `src/lib/indianTaxUtils.ts` (new `roundMoney`), `src/hooks/useBilling.ts`, `src/components/billing/CreateInvoiceModal.tsx`
`subtotal * 0.09`/`subtotal * 0.18`-style GST math was never rounded before being written to the `numeric` DB columns — e.g. `100.10 * 0.09 === 9.008999999999999` in JS, stored verbatim. Confirmed this wasn't hypothetical: a real invoice already in the database (`INV-202627-0001`) has `igst: 142.01999999999998`. Fixed by adding `roundMoney()` (rounds to 2 decimals) and applying it at every calculation site — subtotal, each GST component, and the total (summed from the already-rounded parts, not recomputed, so the line items on a printed invoice always add up to exactly the printed total). This is a targeted fix at the calculation sites, not the larger integer-paise migration Fable's review also mentioned — retyping every money column and consumer across billing/reports is a separate, much larger change than "round before you store it." Pre-existing bad rows backfilled 2026-07-11 via the `backfill_invoice_gst_rounding` migration: audited the full `invoices` table for any column with more than 2dp of stored precision and found exactly 1 affected row (`INV-202627-0001`, `igst` corrected from `142.01999999999998` to `142.02`); re-verified `subtotal + cgst + sgst + igst = total` still balances after rounding.

### M13. Editing a task always shows "Task created successfully" toast
**File:** `src/components/tasks/AddTaskModal.tsx` (`handleSave`)
Found while writing E2E coverage for the Tasks module (`e2e/06-tasks.spec.ts`). `AddTaskModal.handleSave` calls `onSave(payload)` (which in `src/pages/Tasks.tsx` correctly shows "Task updated successfully" vs "Task created successfully" depending on whether `editingTask` is set) and then, regardless of that outcome, *unconditionally* shows its own `toast.success("Task created successfully")` and closes. So every task edit fires both the correct "Task updated successfully" toast from the parent and a second, wrong "Task created successfully" toast from the modal itself. Cosmetic (data is saved correctly either way) but misleading. Not fixed here — out of scope for a test-coverage session; the E2E test only asserts the correct toast appears, since it doesn't assert the incorrect one is absent.
**Fix:** remove the unconditional `toast.success("Task created successfully")` in `AddTaskModal.handleSave` — the parent (`Tasks.tsx`) already owns toast messaging for both create and update.

### M14. WhatsApp template "Duplicate" isn't persisted, and deleting the copy throws
**File:** `src/components/whatsapp/MessageTemplates.tsx` (`handleDuplicate`, `handleDelete`), `src/data/WhatsappApi.ts` (`deleteMessageTemplateFromSupabase`)
Found while writing E2E coverage for WhatsApp (`e2e/07-whatsapp.spec.ts`). `handleDuplicate` only appends a copy to local component state (`setTemplates((prev) => [...prev, dup])`) — unlike every other mutation on this page, it never calls `saveMessageTemplateToSupabase`. The success toast ("Template duplicated") implies persistence that doesn't happen: the copy vanishes on refresh. Worse, if the user tries to delete that copy before refreshing, `handleDelete` calls `deleteMessageTemplateFromSupabase(dup.id)` with the fabricated id (`t-${Date.now()}`, a plain string, not a uuid); `message_templates.id` is `uuid`, so PostgREST rejects the delete with an "invalid input syntax for type uuid" error, which surfaces as a raw, confusing `toast.error`. Reproduced directly against the live DB: confirmed `message_templates.id` is `uuid primary key`, and confirmed via the E2E test that clicking Delete on a freshly-duplicated card never shows the expected "Template deleted" toast (the delete silently fails). Not fixed here — out of scope for a test-coverage session; the new test duplicates a template to verify the button works but deliberately does not attempt to delete the copy (see the comment in the test).
**Fix:** make `handleDuplicate` call `saveMessageTemplateToSupabase` (omitting `id` so it inserts a fresh row) the same way `handleSave` does for a new template, so the copy is real and deletable like any other template.

---

## Low / Cleanup

### L1. Simulated payment checkout presented as real — FIXED (2026-07-06)
`src/components/billing/RazorpayCheckoutModal.tsx` collected card number/CVV/UPI in plain inputs and "processed" via `setTimeout`, then showed a fake `rzp_...` reference. First-pass fix removed the raw card fields and labeled it "Demo Checkout." Now replaced with real Razorpay Checkout.js: `create-razorpay-order` computes the amount server-side and `verify-razorpay-payment` checks Razorpay's HMAC signature before activating a plan — card/UPI/netbanking details go through Razorpay's own hosted iframe, never our servers. Verified live with a real test-mode payment (netbanking): `subscription_payments` row reached `status: 'paid'` and the firm's plan/plan_expiry updated correctly.

### L2. Committed Supabase config in git history
`VITE_SUPABASE_URL` and the publishable anon key were committed (`.env`, commit `80c9007`). The anon key is designed to be public, so impact is low, but committing `.env` at all is a bad pattern — ensure the root `.env` stays untracked (the `.gitignore` currently contains an unresolved merge conflict, see L3).

### L3. Unresolved merge-conflict markers in `.gitignore`
`.gitignore` contains `<<<<<<< HEAD` / `=======` / `>>>>>>>` markers. It still works by luck but should be cleaned up.

### L4. Onboarding/auth resolution falls back to "onboarding" on any error
`resolveStatus` in `src/App.tsx` treats any query error as "go to onboarding." A transient network/RLS error will bounce a fully-onboarded user back into onboarding. Consider distinguishing transient errors from a genuine "no record" state.

### L5. Compliance content hardcoded/stale
`src/data/Settings.ts` ships hardcoded `mockComplianceUpdates` and `mockFirmProfile` (Sharma & Associates) dated 2025. Confirm these mocks aren't surfacing anywhere in production UI.

---

## Architecture & Product Roadmap (Fable architect/PM review, 2026-07-06)

A second-pass review covering architecture and product gaps, not just correctness bugs. Ranked priority order below is the reviewer's combined recommendation, adjusted for what's since shipped in this repo (Razorpay is live — L1; direct Meta WhatsApp send/receive is live — H5/webhook work, so "BSP integration" below is already done, leaving the scheduler as the actual gap).

### P1. Fix the three wrong statutory values — quick, no schema change
The GSTR-4 due date, GSTR-3B/GSTR-1 late fee caps, and GSTR-9 late fee — see H6. Do this first; it's the fastest fix and the one most likely to burn credibility with a CA reviewer if left as-is.

### P2. Move compliance rules out of the JS bundle into `compliance_rules`
See H6's correction above — the table and partial seed data already exist. Scope: complete the seed data (missing filing types, turnover-slabbed `late_fee_rule`), build one resolver function, delete `dueDateRules`/`penaltyRules.ts`/the hardcoded parts of `indianTaxUtils.ts`.

### P3. No scheduler — the core "never miss a deadline" promise is not automated
**Certain, and more fundamental than any BSP gap.** Nothing runs when no one has the app open — no cron, no scheduled Edge Function, no queue. "Send Reminder" requires a human to click it every time. Fix: one Supabase-scheduled Edge Function (`pg_cron` + `pg_net`, calling the function via HTTP on a schedule) that scans tasks due in N days and queues/sends WhatsApp reminders automatically. Without this, the product's core pitch is aspirational, not real.

### P4. Recurrence engine driven by `clients.services_subscribed`
**Biggest product disconnect.** `AddClientModal` collects "Services Subscribed" (ITR, GST monthly/quarterly, TDS...) into `clients.services_subscribed` (jsonb) and nothing reads it to generate tasks. Task creation today is manual or via the bulk generator (a batch workaround for a missing recurrence engine). Should instead auto-generate recurring tasks (with correct due dates once P2 lands) for as long as a service is subscribed. This is the specific gap a Jamku reviewer flagged as missing there — an open competitive flank.

### P5. Excel importer for clients
Every prospect firm has 100–300 existing clients in Excel or Jamku today. No importer means hours of manual re-entry before the product shows any value — likely the single biggest trial-drop-off point. Highest-leverage onboarding feature buildable.

### Also missing (ranked, not yet scheduled against P1–P5)
- **RBAC enforcement — FIXED (2026-07-10).** Two-tier admin/staff RLS + `useUserRole()` frontend gating; see the `feat/basic-rbac` session. `staff.role` is now a real constrained access-control column (job title split out separately), not the old free-text field the UI displayed but nothing enforced.
- **Audit trail — FIXED (2026-07-10).** Generic trigger-based `audit_log` on clients/invoices/payments/tasks/staff, admin-only Settings tab. See the `feat/audit-trail` session.
- **CA-facing notification digest — FIXED (2026-07-10)** as an in-app Dashboard panel ("Today's Digest"), not push (WhatsApp hits the same Meta template-approval wall as reminders; no email provider is wired up). See the `feat/dashboard-today-digest` session.
- **DSC register + portal-password vault — FIXED (2026-07-11)**, encrypted properly per the caution below: Supabase Vault (pgsodium-backed), not plaintext or client-side-only. See the ADR in that session and M10 above for what was deliberately deferred (re-auth, rate-limiting).
- **Receivables aging report — FIXED (2026-07-10)** (30/60/90 days, anchored to invoice_date — see M9). See the `feat/receivables-aging-report` session.
- **Email fallback — FIXED (2026-07-11).** `send-task-reminders` now tries WhatsApp first (unchanged) and falls back to email — via Resend, called directly with `fetch` from Deno the same way the WhatsApp send calls Meta's REST API, no SDK — whenever a client has no phone number or the WhatsApp send failed but an email address exists. New `email_sent_messages` table logs the fallback channel (mirrors `whatsapp_sent_messages`'s shape; kept as a separate table rather than a polymorphic "channel" column so provider-specific fields — `wamid` vs `provider_message_id` — stay typed). Inert until `RESEND_API_KEY`/`RESEND_FROM_EMAIL` function secrets are set (same opt-in pattern as Sentry) — no Resend account exists for this project yet, and the sender email needs a verified domain in Resend before it can deliver to arbitrary client addresses (Resend's unverified `onboarding@resend.dev` sender only delivers to the account owner's own address). See the `feat/email-fallback-reminders` session.
- **Smaller, cheap, high-value-to-fix — FIXED (2026-07-11):** `financialYears` now generated by `generateFinancialYears()` (a rolling window anchored to the current date) instead of a fixed array that would have silently stopped including "now" past April 2028; `send-task-reminders`/`generate-recurring-tasks` edge functions now explicitly shift to IST before extracting a calendar date rather than relying on the (UTC) runtime's local time, which matters most in the ~5.5-hour window right at IST midnight (see M11/M12 for a related bug found along the way); invoice GST math now rounds at each calculation site instead of storing raw float artifacts (M12); Sentry wired up via `src/lib/errorMonitoring.ts` + a root `ErrorBoundary`, inert until a `VITE_SENTRY_DSN` is added to `.env` (no Sentry account exists for this project yet — that's a decision/signup for the user, not something buildable from this session).

### Explicitly NOT building (by design, not oversight)
Attendance/geo-tracking, inward-outward registers, timesheets. Incumbents (Jamku) have these; matching them feature-for-feature makes this app a worse Jamku. The differentiation is WhatsApp-native client communication plus auto-recurrence (P3/P4) — depth there over breadth elsewhere.

### Penalty calculator publishability gate
The Penalty Calculator is a plausible lead magnet, but only once P1 (turnover-slab logic, in particular) is fixed and a nil-return toggle plus an actual-shortfall input (replacing the fabricated `assumedShortfall`) are added — as shipped, it would damage credibility with the exact audience it's meant to attract.

---

## What looks good
- Multi-tenant isolation via `get_my_firm_id()` on the main data tables (`clients`, `tasks`, `invoices`, `payments`, etc.) is a sound pattern, and RLS is enabled on all public tables.
- The document storage bucket is private (not public).
- Auth routing has a clear single-source-of-truth state machine, and the app has a Playwright/Vitest test setup already in place.

---

## Suggested priority order
1. **C1** (uploads don't work) and **C2** (cross-tenant data leak) — these break the core promise and leak data.
2. **C3 / H2 / H1** — credential exposure and the broken firm-bootstrap/onboarding path.
3. **H3 / H4 / H5** — visible correctness bugs in billing, documents, and WhatsApp.
4. **M1** TypeScript errors (fix the `ClientMutationResult` comparisons first — real logic bugs).
5. Remaining Medium/Low items.
