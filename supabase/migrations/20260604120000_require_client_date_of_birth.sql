-- Require DOB / incorporation date for clients (BUG-03).
-- Existing rows are backfilled so the NOT NULL constraint can be applied safely.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS date_of_birth date;

UPDATE public.clients
SET date_of_birth = CURRENT_DATE
WHERE date_of_birth IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN date_of_birth SET NOT NULL;
