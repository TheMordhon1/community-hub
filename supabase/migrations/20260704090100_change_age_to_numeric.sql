-- Change age column type in competition_teams to numeric to support decimals (e.g. 1.6 for kids)
ALTER TABLE public.competition_teams
  ALTER COLUMN age TYPE numeric;

-- Make user_id nullable in competition_team_members to support manual (non-registered) members
ALTER TABLE public.competition_team_members
  ALTER COLUMN user_id DROP NOT NULL;

-- Add a name column for storing manual member names
ALTER TABLE public.competition_team_members
  ADD COLUMN IF NOT EXISTS name text;
