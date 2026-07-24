-- CRITICAL: message_templates had two overlapping sets of RLS policies —
-- the correct firm-scoped `templates_all` (firm_id = get_my_firm_id()) added
-- later, alongside four older policies scoped only by `auth.uid() = user_id`
-- (no firm_id check) that were never dropped when templates_all was added.
-- Postgres ORs multiple PERMISSIVE policies for the same command together,
-- so a row only needs to satisfy ONE of them — meaning any authenticated
-- user could INSERT a message_templates row with an arbitrary firm_id (any
-- other firm's), as long as user_id matched their own auth.uid(), because
-- the legacy INSERT policy's WITH CHECK never looked at firm_id at all.
-- Confirmed exploitable live during a security audit (2026-07-23): signed
-- in as a real staff member of one firm, inserted a template with a
-- different firm's firm_id, insert succeeded. Same "duplicate/overlapping
-- RLS policy" bug class as M6 (firms), just never caught for this table.
--
-- Fix: drop the four legacy user_id-only policies. templates_all already
-- correctly covers SELECT/INSERT/UPDATE/DELETE via its single ALL policy —
-- for a FOR ALL policy with no explicit WITH CHECK, Postgres uses the
-- USING expression (firm_id = get_my_firm_id()) as the WITH CHECK too, so
-- no replacement policy is needed, only removing the bypass.
drop policy if exists "Users can delete their own templates" on public.message_templates;
drop policy if exists "Users can insert their own templates" on public.message_templates;
drop policy if exists "Users can select their own templates" on public.message_templates;
drop policy if exists "Users can update their own templates" on public.message_templates;
