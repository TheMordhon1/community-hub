
-- Add is_point column to competition_matches
ALTER TABLE public.competition_matches ADD COLUMN IF NOT EXISTS is_point BOOLEAN DEFAULT TRUE;

-- Update existing matches to have is_point = true
UPDATE public.competition_matches SET is_point = TRUE WHERE is_point IS NULL;
