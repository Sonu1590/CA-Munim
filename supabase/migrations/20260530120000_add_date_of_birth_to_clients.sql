-- Add date_of_birth for client DOB / incorporation date (BUG-03)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS date_of_birth date;

COMMENT ON COLUMN public.clients.date_of_birth IS 'Date of birth (individuals) or incorporation (companies)';
