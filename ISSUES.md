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

### H4. Pending document requests all show "Unknown Client"
**Live app:** `/documents` → Pending Requests
Every row renders "Unknown Client" instead of the client name. The join from `document_requests` to the client name is not resolving (likely missing/incorrect `client_id` linkage or the query doesn't select the related client). A CA can't tell which client a request belongs to.

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
**Correction (2026-07-06, verified against live DB):** this table already exists — `public.compliance_rules` (`due_date_rule`/`late_fee_rule` jsonb, `effective_from`/`effective_to`, `applicable_states`) — with 14 seeded rows, but **nothing in the frontend reads it**; `dueDateRules`/`penaltyRules.ts` remain the only thing actually consulted. The seeded data is itself a mix: due dates for GSTR-1/GSTR-3B (including separate `GSTR-3B_QRMP_CAT1`/`CAT2` rows at 22nd/24th — QRMP *is* modeled here, contrary to the frontend gap) and TDS look correct, but `late_fee_rule` for GSTR-1/GSTR-3B/GSTR-9 is still flat (not turnover-slabbed) and several filing types are missing entirely (GSTR-4, CMP-08, MGT-7, AOC-4, DIR-3 KYC, Form 16, ADT-1, INC-20A, PAS-3). Similarly, `clients.gst_filing_freq` and `clients.gst_turnover_category` already exist and are captured in `AddClientModal` — the "QRMP flag" and "turnover slab" data model gap PM review flagged below is largely a **wiring gap**, not a missing-column gap. Fix scope is: (1) complete/correct the seeded rows (add missing filing types, fix late-fee JSON to a turnover-slab shape), (2) build a resolver (rule + client's filing-frequency/turnover-category + as-of date → due date/penalty) and switch every caller to it, (3) delete the hardcoded constants.

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
- **RBAC enforcement.** `staff.role` exists (Senior CA / Article Clerk / Admin Staff in the UI) but nothing enforces it server-side — any staff login can delete invoices, edit clients, see all fees. Acceptable for solo practitioners at launch; blocking for firms with 3+ staff and a partner/manager/article hierarchy.
- **Audit trail.** No record of who changed a task status or edited an invoice. For a profession built on audit, this gap will be noticed in demos.
- **CA-facing notification digest** (morning email/WhatsApp summary of today's due tasks) — cheap once P3 (scheduler) exists.
- **DSC register + portal-password vault.** Incumbents (Jamku) treat these as headline features — CAs juggle dozens of client GST/IT portal logins and physical DSC tokens with expiry dates. Low build cost, high perceived value, **but a badly-built password vault is a liability — encrypt properly (not plaintext, not client-side-only) or defer entirely.** Not scheduled until we're ready to do the encryption properly.
- **Receivables aging report** (30/60/90 days) — billing data already supports this; fee recovery is a chronic CA pain point.
- **Email fallback** for the minority of clients not reachable on WhatsApp.
- **Smaller, cheap, high-value-to-fix:** `financialYears` array hardcoded ending at FY 2027-28 (silent failure in ~2 years); due-date/reminder timing math uses client-local `new Date()` instead of IST (off-by-one risk for users abroad or near midnight); money handled as floats rather than integer paise (precision-bug-prone); no error monitoring (Sentry or equivalent) — production failures like the earlier "success toast, zero rows written" class of bug (L5, M1) stay invisible without one.

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
