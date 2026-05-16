
-- Add status column to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'public' CHECK (status IN ('draft', 'public'));

-- Update RLS policies for events
-- Public users (warga/anonymous) can only see 'public' events
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Anyone can view public events" ON public.events
    FOR SELECT USING (status = 'public');

-- Admins and Pengurus can see all events (including drafts)
CREATE POLICY "Admins and Pengurus can view all events" ON public.events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );

-- Admins and Pengurus can manage events
DROP POLICY IF EXISTS "Admins and Pengurus can manage events" ON public.events;
CREATE POLICY "Admins and Pengurus can manage events" ON public.events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );
