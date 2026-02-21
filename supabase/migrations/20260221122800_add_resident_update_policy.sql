-- Migration to allow residents to update their own house occupancy status
-- This policy allows users linked to a house in house_residents to update that house in the houses table.

CREATE POLICY "Residents can update their own house status" ON public.houses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.house_residents
      WHERE house_residents.house_id = public.houses.id
      AND house_residents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.house_residents
      WHERE house_residents.house_id = public.houses.id
      AND house_residents.user_id = auth.uid()
    )
  );
