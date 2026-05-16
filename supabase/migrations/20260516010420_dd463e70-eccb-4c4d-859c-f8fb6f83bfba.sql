ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date timestamp with time zone;
ALTER TABLE public.event_competitions ADD COLUMN IF NOT EXISTS custom_match_label text;