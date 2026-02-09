-- Create a new permissive policy that allows admins/pengurus to insert for any house
CREATE POLICY "Users can insert payments"
ON public.payments FOR INSERT
WITH CHECK (
  -- Admin and Pengurus can insert for any house/user
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pengurus') OR
  -- Regular users can only insert for their own house
  (
    auth.uid() = submitted_by AND 
    EXISTS (
      SELECT 1 FROM public.house_residents 
      WHERE house_id = payments.house_id AND user_id = auth.uid()
    )
  )
);
