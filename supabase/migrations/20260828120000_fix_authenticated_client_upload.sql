-- Document upload from the public /upload/:token portal failed whenever the
-- visitor's browser happened to have an active CA Munim staff session in
-- localStorage (same-origin, shared across all tabs) — e.g. a CA testing
-- their own WhatsApp link on the same desktop Chrome they're logged into,
-- or a colleague opening it on a shared machine. Reported: fails on desktop
-- Chrome (opened via WhatsApp Desktop), works fine on mobile (a phone
-- typically has no such session at all, so the request really is anonymous).
--
-- Root cause: there were exactly two storage INSERT policies —
-- "anon client portal uploads" (role `anon`, path client-uploads/<token>/...)
-- and "firm_upload" (role `authenticated`, path <firm_id>/...). supabase-js
-- automatically attaches whatever session is in localStorage to every
-- request, so a browser with an active staff login sends the upload as
-- `authenticated`, not `anon` — and NO policy grants an authenticated user
-- access to the client-uploads/ path. RLS rejects the insert outright
-- (a 400), regardless of how valid the upload token itself is. This is the
-- write-side mirror of the read-side gap already fixed under C8
-- (20260826180000_fix_client_upload_read_access.sql) — that migration
-- extended firm_read/firm_delete for this same path shape; this one extends
-- the INSERT side the same way it should have from the start.
--
-- Fix: grant `authenticated` the same client-uploads/ INSERT permission
-- `anon` already has. The anon policy itself doesn't validate the token
-- against document_requests at the storage layer either — actual
-- authorization of which document_requests row a file belongs to happens
-- downstream in record_client_upload()'s SECURITY DEFINER token check, same
-- as today. This just stops an authenticated bystander session from being
-- treated worse than a fully anonymous one for the identical, already-public
-- upload path.

drop policy if exists "authenticated client portal uploads" on storage.objects;
create policy "authenticated client portal uploads"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ca-munim-documents'
    and (storage.foldername(name))[1] = 'client-uploads'
  );
