-- Drop existing update and delete policies on payments
DROP POLICY IF EXISTS "Admins and Pengurus can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

-- Create new update policy: Admins/Pengurus can update any, users can update their own pending payments
CREATE POLICY "Users can update own pending or admins/pengurus can update all"
ON public.payments
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
  OR (submitted_by = auth.uid() AND status = 'pending'::payment_status)
);

-- Create new delete policy: Admins can delete any, users can delete their own pending payments
CREATE POLICY "Users can delete own pending or admins can delete all"
ON public.payments
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (submitted_by = auth.uid() AND status = 'pending'::payment_status)
);