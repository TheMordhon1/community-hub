-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view houses" ON public.houses;

-- Create a permissive SELECT policy that allows anyone (including unauthenticated users) to view houses
CREATE POLICY "Anyone can view houses" 
ON public.houses 
FOR SELECT 
TO anon, authenticated
USING (true);