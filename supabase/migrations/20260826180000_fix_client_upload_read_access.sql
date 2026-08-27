-- Client-portal-uploaded documents were permanently unreadable by the firm's
-- own staff — View/Download always failed. Two independent bugs found while
-- investigating a user report ("view throws error", "download fails: 400"):
--
-- 1. Frontend bug (fixed separately in ClientDocumentFolder.tsx): resolveFileUrl
--    queried a bucket named "documents", which doesn't exist — the real bucket
--    is "ca-munim-documents" (confirmed live: select id from storage.buckets).
--    That alone produced the literal "Bucket not found" error the user saw.
--
-- 2. This migration's bug — structural, not a typo: even with the right bucket
--    name, the bucket is PRIVATE (public: false), and the existing "firm_read"/
--    "firm_delete" policies only grant access under a path prefixed with the
--    caller's own firm id ((storage.foldername(name))[1] = get_my_firm_id()).
--    But record_client_upload() (20260702120000_client_upload_portal.sql)
--    stores the anon-uploaded file's raw storage path verbatim as
--    documents.file_url — and that path is `client-uploads/<token>/...`
--    (chosen specifically because an anonymous /upload/:token visitor has no
--    firm_id to scope by). So every file a client ever uploads through the
--    portal lives under a path the firm_read policy structurally can never
--    match, regardless of the frontend fix. The write path (record_client_upload,
--    SECURITY DEFINER + token check) was correctly scoped per CLAUDE.md's
--    anonymous-surface rule; only the READ side never accounted for it.
--
-- Fix: extend firm_read/firm_delete with a second branch — allow access to a
-- client-uploads/<token>/... object when that token belongs to a
-- document_requests row owned by the caller's own firm (get_my_firm_id()),
-- joining through the same document_requests table the RPC itself validates
-- against. This is the get_my_firm_id() pattern CLAUDE.md calls for, applied
-- via a join since the object's path itself can't carry a firm id.

drop policy if exists "firm_read" on storage.objects;
create policy "firm_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ca-munim-documents'
    and (
      (storage.foldername(name))[1] = (get_my_firm_id())::text
      or (
        (storage.foldername(name))[1] = 'client-uploads'
        and exists (
          select 1 from public.document_requests dr
          where dr.upload_token = (storage.foldername(name))[2]
            and dr.firm_id = get_my_firm_id()
        )
      )
    )
  );

drop policy if exists "firm_delete" on storage.objects;
create policy "firm_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'ca-munim-documents'
    and (
      (storage.foldername(name))[1] = (get_my_firm_id())::text
      or (
        (storage.foldername(name))[1] = 'client-uploads'
        and exists (
          select 1 from public.document_requests dr
          where dr.upload_token = (storage.foldername(name))[2]
            and dr.firm_id = get_my_firm_id()
        )
      )
    )
  );

-- Note: firm_read/firm_upload/firm_delete were never captured in a tracked
-- migration originally (created directly against the live project) — this
-- migration is the first record of their shape, now current as of this fix.
