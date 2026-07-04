
ALTER TABLE public.event_competitions
  ADD COLUMN IF NOT EXISTS group_count integer,
  ADD COLUMN IF NOT EXISTS sets_per_match integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS advance_per_group integer DEFAULT 2;

ALTER TABLE public.competition_teams
  ADD COLUMN IF NOT EXISTS group_name text;

ALTER TABLE public.competition_matches
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS sets_data jsonb;
