
-- Add is_point column to event_competitions
ALTER TABLE public.event_competitions ADD COLUMN IF NOT EXISTS is_point BOOLEAN DEFAULT TRUE;

-- Update existing competitions
UPDATE public.event_competitions SET is_point = TRUE WHERE is_point IS NULL;

-- Function to sync is_point to matches when competition is updated
CREATE OR REPLACE FUNCTION sync_competition_is_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_point IS DISTINCT FROM OLD.is_point THEN
        UPDATE public.competition_matches
        SET is_point = NEW.is_point
        WHERE competition_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync is_point
DROP TRIGGER IF EXISTS trg_sync_competition_is_point ON public.event_competitions;
CREATE TRIGGER trg_sync_competition_is_point
    AFTER UPDATE OF is_point ON public.event_competitions
    FOR EACH ROW
    EXECUTE FUNCTION sync_competition_is_point();
