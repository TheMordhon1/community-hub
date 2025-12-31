-- Allow newly registered users to insert their own house_residents record
CREATE POLICY "Users can insert own house_resident" 
ON public.house_residents 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to mark a house as occupied during registration
CREATE POLICY "Users can update house occupancy during registration" 
ON public.houses 
FOR UPDATE 
TO authenticated
USING (is_occupied = false)
WITH CHECK (is_occupied = true);