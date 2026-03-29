-- Comprehensive RLS fix for inventory_borrows and inventory_borrow_items
-- This ensures owners and housemates can fully manage pending borrows without duplication

-- 1. inventory_borrows
DROP POLICY IF EXISTS "Users can view own borrows or admins/pengurus can view all" ON public.inventory_borrows;
DROP POLICY IF EXISTS "Housemates can view borrows" ON public.inventory_borrows;
CREATE POLICY "Users and housemates can view borrows"
ON public.inventory_borrows FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

DROP POLICY IF EXISTS "Admins and Pengurus can update borrow requests" ON public.inventory_borrows;
CREATE POLICY "Owners, housemates and admins can update pending borrows"
ON public.inventory_borrows FOR UPDATE TO authenticated
USING (
  (
    (user_id = auth.uid() OR house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
)
WITH CHECK (
  (
    (user_id = auth.uid() OR house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

DROP POLICY IF EXISTS "Users can delete own pending or admins can delete all" ON public.inventory_borrows;
CREATE POLICY "Owners, housemates and admins can delete pending borrows"
ON public.inventory_borrows FOR DELETE TO authenticated
USING (
  (
    (user_id = auth.uid() OR house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- 2. inventory_borrow_items
DROP POLICY IF EXISTS "Anyone can view borrow items for accessible borrows" ON public.inventory_borrow_items;
CREATE POLICY "Users can view borrow items for accessible borrows"
ON public.inventory_borrow_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inventory_borrows ib
    WHERE ib.id = inventory_borrow_items.borrow_id
    AND (
      ib.user_id = auth.uid()
      OR ib.house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'pengurus')
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can insert borrow items" ON public.inventory_borrow_items;
CREATE POLICY "Owners and housemates can insert items into pending borrows"
ON public.inventory_borrow_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.inventory_borrows ib
    WHERE ib.id = borrow_id
    AND (ib.user_id = auth.uid() OR ib.house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND ib.status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

DROP POLICY IF EXISTS "Admins and Pengurus can update borrow items" ON public.inventory_borrow_items;
CREATE POLICY "Owners, housemates and admins can update pending borrow items"
ON public.inventory_borrow_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inventory_borrows ib
    WHERE ib.id = inventory_borrow_items.borrow_id
    AND (ib.user_id = auth.uid() OR ib.house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND ib.status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

DROP POLICY IF EXISTS "Admins can delete borrow items" ON public.inventory_borrow_items;
DROP POLICY IF EXISTS "Users can delete own pending borrow items or admins" ON public.inventory_borrow_items;
CREATE POLICY "Owners, housemates and admins can delete pending borrow items"
ON public.inventory_borrow_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.inventory_borrows ib
    WHERE ib.id = inventory_borrow_items.borrow_id
    AND (ib.user_id = auth.uid() OR ib.house_id IN (SELECT house_id FROM public.house_members WHERE user_id = auth.uid()))
    AND ib.status = 'pending'
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
