
CREATE POLICY "Pengurus can update houses"
ON public.houses
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'pengurus'::app_role))
WITH CHECK (has_role(auth.uid(), 'pengurus'::app_role));
