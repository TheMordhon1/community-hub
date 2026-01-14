-- Drop existing delete policies
DROP POLICY IF EXISTS "Authors and admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;

-- Create new delete policies that include pengurus
CREATE POLICY "Admins pengurus and authors can delete events" 
ON public.events 
FOR DELETE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pengurus') OR (auth.uid() = author_id));

CREATE POLICY "Admins and Pengurus can delete announcements" 
ON public.announcements 
FOR DELETE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'pengurus'));