ALTER TABLE public.competition_referees ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.competition_referees ADD COLUMN IF NOT EXISTS manual_name text;
ALTER TABLE public.competition_referees ADD CONSTRAINT competition_referees_identity_check CHECK (user_id IS NOT NULL OR (manual_name IS NOT NULL AND length(btrim(manual_name)) > 0));