-- Add house_block and house_number columns to competition_team_members to store house info for manual members
ALTER TABLE public.competition_team_members
  ADD COLUMN IF NOT EXISTS house_block text,
  ADD COLUMN IF NOT EXISTS house_number text;
