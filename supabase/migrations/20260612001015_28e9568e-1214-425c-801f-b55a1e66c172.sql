
ALTER TABLE public.event_competitions
  ADD COLUMN IF NOT EXISTS kids_brackets jsonb;

ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS age_bracket_min numeric(4,1),
  ADD COLUMN IF NOT EXISTS age_bracket_max numeric(4,1),
  ADD COLUMN IF NOT EXISTS age_bracket_label text;
