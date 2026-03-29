
-- Allow users to delete their own pending borrow requests
DROP POLICY IF EXISTS "Admins can delete borrow requests" ON public.inventory_borrows;
CREATE POLICY "Users can delete own pending or admins can delete all"
ON public.inventory_borrows
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (auth.uid() = user_id AND status = 'pending')
);

-- Allow users to delete borrow items from their own pending borrows
DROP POLICY IF EXISTS "Admins can delete borrow items" ON public.inventory_borrow_items;
CREATE POLICY "Users can delete own pending borrow items or admins"
ON public.inventory_borrow_items
FOR DELETE
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  EXISTS (
    SELECT 1 FROM public.inventory_borrows ib 
    WHERE ib.id = inventory_borrow_items.borrow_id 
    AND ib.user_id = auth.uid() 
    AND ib.status = 'pending'
  ) OR
  has_role(auth.uid(), 'pengurus'::app_role)
);
