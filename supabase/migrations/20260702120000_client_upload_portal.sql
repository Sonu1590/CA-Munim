-- Client document upload portal: make anonymous uploads actually persist.
--
-- Before this migration the public /upload/:token page only simulated an
-- upload and flipped the request status. Files were never stored and no
-- documents row was created. This migration adds the minimum backend needed
-- for a secure anonymous upload:
--   1. A narrowly-scoped storage INSERT policy for the `anon` role.
--   2. A SECURITY DEFINER RPC that validates the token server-side and records
--      the uploaded files against the correct firm/client.

-- 1. Storage: allow anonymous portal visitors to UPLOAD (insert only) into the
--    private documents bucket, restricted to the `client-uploads/` prefix.
--    No SELECT/UPDATE/DELETE is granted to anon, so files cannot be read back
--    or enumerated through the anon key.
drop policy if exists "anon client portal uploads" on storage.objects;
create policy "anon client portal uploads"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'ca-munim-documents'
    and (storage.foldername(name))[1] = 'client-uploads'
  );

-- 2. RPC: validate the upload token, record each uploaded file as a documents
--    row scoped to the request's firm/client, then mark the request uploaded.
--    SECURITY DEFINER lets it write firm-scoped rows that anon cannot write
--    directly, while the token check enforces authorization.
create or replace function public.record_client_upload(
  p_token text,
  p_files jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.document_requests%rowtype;
  v_file jsonb;
begin
  select * into v_req
  from public.document_requests
  where upload_token = p_token
    and status = 'pending'
  limit 1;

  if v_req.id is null then
    raise exception 'Invalid or already-used upload link';
  end if;

  if p_files is null or jsonb_array_length(p_files) = 0 then
    raise exception 'No files provided';
  end if;

  for v_file in select * from jsonb_array_elements(p_files)
  loop
    insert into public.documents (
      firm_id, client_id, upload_request_id,
      file_name, file_url, file_size, file_type, category
    )
    values (
      v_req.firm_id,
      v_req.client_id,
      v_req.id,
      v_file->>'name',
      v_file->>'url',
      nullif(v_file->>'size', '')::bigint,
      v_file->>'type',
      'Other'
    );
  end loop;

  update public.document_requests
  set status = 'uploaded',
      uploaded_at = now()
  where id = v_req.id;
end;
$$;

grant execute on function public.record_client_upload(text, jsonb) to anon, authenticated;
