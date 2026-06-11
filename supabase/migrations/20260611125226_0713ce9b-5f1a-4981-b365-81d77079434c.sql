
-- Add age category to competitions
ALTER TABLE public.event_competitions
  ADD COLUMN IF NOT EXISTS age_category text NOT NULL DEFAULT 'mixed';

-- Add participant fields to teams (each team = 1 registration in new flow)
ALTER TABLE public.competition_teams
  ADD COLUMN IF NOT EXISTS participant_name text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS age_group text;

-- Drop existing unique constraint to allow same house multiple registrations across age groups
ALTER TABLE public.competition_teams
  DROP CONSTRAINT IF EXISTS competition_teams_competition_id_name_key;
