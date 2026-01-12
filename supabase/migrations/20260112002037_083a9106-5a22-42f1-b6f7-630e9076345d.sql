-- Drop existing policies
DROP POLICY IF EXISTS "Admins and Pengurus can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- Create new update policy: admins/pengurus can update any, authors can update own
CREATE POLICY "Authors admins pengurus can update events" 
ON public.events 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'pengurus'::app_role) OR 
  auth.uid() = author_id
);

-- Create new delete policy: admins can delete any, authors can delete own
CREATE POLICY "Authors and admins can delete events" 
ON public.events 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  auth.uid() = author_id
);