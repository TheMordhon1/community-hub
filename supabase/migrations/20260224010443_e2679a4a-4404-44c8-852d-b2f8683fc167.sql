
-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can delete emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Admins can insert emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Admins can update emergency contacts" ON public.emergency_contacts;

-- Create new policies allowing both admin and pengurus
CREATE POLICY "Admins and Pengurus can insert emergency contacts"
ON public.emergency_contacts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can update emergency contacts"
ON public.emergency_contacts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can delete emergency contacts"
ON public.emergency_contacts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));
