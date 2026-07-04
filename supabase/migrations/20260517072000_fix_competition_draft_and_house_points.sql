-- 1. Fix RLS for event_competitions to hide 'draft' from regular users
ALTER TABLE public.event_competitions ENABLE ROW LEVEL SECURITY;

-- Drop existing public read policy if any (might be named differently, but we try common names)
DROP POLICY IF EXISTS "Anyone can view event_competitions" ON public.event_competitions;
DROP POLICY IF EXISTS "Anyone can view active event_competitions" ON public.event_competitions;
DROP POLICY IF EXISTS "Public can view competitions" ON public.event_competitions;

-- Create new policy: Regular users only see non-drafts. Admin/Pengurus see all.
CREATE POLICY "View active event_competitions or all if admin"
ON public.event_competitions FOR SELECT
TO authenticated
USING (
    status != 'draft' 
    OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'pengurus')
    )
);

-- Note: Other policies (INSERT, UPDATE, DELETE) for event_competitions likely already exist for admins.
-- This ensures 'draft' is hidden from 'warga'.

-- 2. Sync Gamification Points Across House Members
-- Create a trigger function to keep points synchronized for all members of a house
CREATE OR REPLACE FUNCTION public.sync_house_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house_id UUID;
BEGIN
    -- Only trigger if points actually changed
    IF NEW.points IS DISTINCT FROM OLD.points THEN
        -- Find if the user belongs to a house
        SELECT house_id INTO v_house_id 
        FROM public.house_members 
        WHERE user_id = NEW.id 
        LIMIT 1;

        -- If they belong to a house, sync points to all other members
        IF v_house_id IS NOT NULL THEN
            UPDATE public.profiles
            SET points = NEW.points
            WHERE id IN (
                SELECT user_id 
                FROM public.house_members 
                WHERE house_id = v_house_id 
                AND user_id != NEW.id
            ) 
            AND points != NEW.points; -- Prevent infinite trigger recursion
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_sync_house_points ON public.profiles;

-- Create trigger on profiles
CREATE TRIGGER trg_sync_house_points
AFTER UPDATE OF points ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_house_points();

-- 3. Initial sync for existing house members
-- Just to be safe, set everyone's points to the max points found in their house
DO $$
DECLARE
    h RECORD;
    max_pts INTEGER;
BEGIN
    FOR h IN SELECT DISTINCT house_id FROM public.house_members LOOP
        -- Find max points in this house
        SELECT MAX(p.points) INTO max_pts
        FROM public.profiles p
        JOIN public.house_members hr ON p.id = hr.user_id
        WHERE hr.house_id = h.house_id;
        
        -- Sync everyone in the house to the max points
        IF max_pts > 0 THEN
            UPDATE public.profiles
            SET points = max_pts
            WHERE id IN (
                SELECT user_id FROM public.house_members WHERE house_id = h.house_id
            ) AND (points IS NULL OR points < max_pts);
        END IF;
    END LOOP;
END $$;
