-- Drop all existing policies on event_competitions for SELECT
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'event_competitions' 
        AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.event_competitions', pol.policyname);
    END LOOP;
END $$;

-- Create the single, definitive read policy
CREATE POLICY "View event_competitions based on role and status"
ON public.event_competitions FOR SELECT
USING (
    status != 'draft' 
    OR (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    )
);
