-- Allow anon users to view houses for registration
CREATE POLICY "Anon can view houses"
ON public.houses FOR SELECT
TO anon
USING (true);

-- Allow anon users to view unlinked house members for claiming
-- This enables the registration page to show family members that haven't registered yet
CREATE POLICY "Anon can view unlinked house members"
ON public.house_members FOR SELECT
TO anon
USING (user_id IS NULL);

-- Allow authenticated users to claim an unlinked profile
-- This is used during registration right after the user account is created
CREATE POLICY "Users can claim unlinked profiles"
ON public.house_members FOR UPDATE
TO authenticated
USING (user_id IS NULL)
WITH CHECK (user_id = auth.uid());
