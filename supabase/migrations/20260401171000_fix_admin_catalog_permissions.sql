-- Fix store catalog items INSERT policy to include admins
DROP POLICY IF EXISTS "House members can manage catalog items" ON public.store_catalog_items;
CREATE POLICY "Managers can insert catalog items"
ON public.store_catalog_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s 
    WHERE s.id = store_catalog_items.store_id 
    AND (
      s.created_by = auth.uid() 
      OR is_house_member(auth.uid(), s.house_id)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'pengurus'::app_role)
    )
  )
);

-- Ensure UPDATE and DELETE also explicitly include pengurus for consistency
DROP POLICY IF EXISTS "House members can update catalog items" ON public.store_catalog_items;
CREATE POLICY "Managers can update catalog items"
ON public.store_catalog_items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s 
    WHERE s.id = store_catalog_items.store_id 
    AND (
      s.created_by = auth.uid() 
      OR is_house_member(auth.uid(), s.house_id)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'pengurus'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "House members can delete catalog items" ON public.store_catalog_items;
CREATE POLICY "Managers can delete catalog items"
ON public.store_catalog_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s 
    WHERE s.id = store_catalog_items.store_id 
    AND (
      s.created_by = auth.uid() 
      OR is_house_member(auth.uid(), s.house_id)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'pengurus'::app_role)
    )
  )
);
