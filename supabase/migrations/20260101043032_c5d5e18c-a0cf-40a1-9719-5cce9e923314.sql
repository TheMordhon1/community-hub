-- Allow all authenticated users to view pengurus roles (for organization structure page)
CREATE POLICY "Anyone can view pengurus roles"
ON public.user_roles
FOR SELECT
USING (role = 'pengurus');