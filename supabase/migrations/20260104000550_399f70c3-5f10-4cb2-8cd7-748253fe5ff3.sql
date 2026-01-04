-- Drop existing delete policy
DROP POLICY IF EXISTS "Admin can delete finance records" ON public.finance_records;

-- Create new delete policy allowing admin or users with finance access
CREATE POLICY "Admin or Finance Access can delete finance records"
ON public.finance_records
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'pengurus'::app_role) AND has_finance_access(auth.uid()))
);