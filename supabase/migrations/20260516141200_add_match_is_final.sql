-- Add is_final column to competition_matches
ALTER TABLE public.competition_matches 
ADD COLUMN is_final BOOLEAN DEFAULT false;

-- Update existing matches that have 'final' in their phase_label
UPDATE public.competition_matches 
SET is_final = true 
WHERE phase_label ILIKE '%final%';
