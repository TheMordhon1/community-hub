-- Add is_individual column to competition_teams to distinguish between full team entries and individual registrants who need team assignment.
ALTER TABLE public.competition_teams
  ADD COLUMN IF NOT EXISTS is_individual boolean DEFAULT false;
