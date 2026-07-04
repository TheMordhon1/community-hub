-- Trigger to automatically sync competition status to 'draft' when parent event becomes 'draft'
CREATE OR REPLACE FUNCTION public.sync_competition_status_from_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If the event status changes to 'draft', update associated competitions to 'draft'
    IF NEW.status = 'draft' AND (OLD.status IS DISTINCT FROM 'draft' OR OLD.status IS NULL) THEN
        UPDATE public.event_competitions
        SET status = 'draft'
        WHERE event_id = NEW.id 
        AND status != 'draft';
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_competition_status_from_event ON public.events;

CREATE TRIGGER trg_sync_competition_status_from_event
AFTER UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_competition_status_from_event();
