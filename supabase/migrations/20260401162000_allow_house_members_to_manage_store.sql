-- Update stores update policy
DROP POLICY IF EXISTS "Owners can update own pending stores" ON public.stores;
CREATE POLICY "Owners and house members can update stores"
ON public.stores FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() 
  OR is_house_member(auth.uid(), house_id) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
);

-- Update stores delete policy
DROP POLICY IF EXISTS "Owners can delete own stores or admin" ON public.stores;
CREATE POLICY "Owners and house members can delete stores"
ON public.stores FOR DELETE
TO authenticated
USING (
  created_by = auth.uid() 
  OR is_house_member(auth.uid(), house_id) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Update store catalog items manage policy
DROP POLICY IF EXISTS "Store owners can manage catalog items" ON public.store_catalog_items;
CREATE POLICY "House members can manage catalog items"
ON public.store_catalog_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.stores s 
  WHERE s.id = store_catalog_items.store_id 
  AND (s.created_by = auth.uid() OR is_house_member(auth.uid(), s.house_id))
));

-- Update store catalog items update policy
DROP POLICY IF EXISTS "Store owners can update catalog items" ON public.store_catalog_items;
CREATE POLICY "House members can update catalog items"
ON public.store_catalog_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s 
  WHERE s.id = store_catalog_items.store_id 
  AND (s.created_by = auth.uid() OR is_house_member(auth.uid(), s.house_id))
) OR has_role(auth.uid(), 'admin'::app_role));

-- Update store catalog items delete policy
DROP POLICY IF EXISTS "Store owners can delete catalog items" ON public.store_catalog_items;
CREATE POLICY "House members can delete catalog items"
ON public.store_catalog_items FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s 
  WHERE s.id = store_catalog_items.store_id 
  AND (s.created_by = auth.uid() OR is_house_member(auth.uid(), s.house_id))
) OR has_role(auth.uid(), 'admin'::app_role));
