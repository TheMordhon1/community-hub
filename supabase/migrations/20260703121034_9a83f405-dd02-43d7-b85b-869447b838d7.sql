-- Add gender category to competitions and gender to participants
ALTER TABLE public.event_competitions
  ADD COLUMN IF NOT EXISTS gender_category text NOT NULL DEFAULT 'mixed';

ALTER TABLE public.event_competitions
  DROP CONSTRAINT IF EXISTS event_competitions_gender_category_check;
ALTER TABLE public.event_competitions
  ADD CONSTRAINT event_competitions_gender_category_check
  CHECK (gender_category IN ('mixed','male','female'));

ALTER TABLE public.competition_teams
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.competition_teams
  DROP CONSTRAINT IF EXISTS competition_teams_gender_check;
ALTER TABLE public.competition_teams
  ADD CONSTRAINT competition_teams_gender_check
  CHECK (gender IS NULL OR gender IN ('male','female'));