-- Add house_id column to inventory_borrows
ALTER TABLE public.inventory_borrows
  ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES public.houses(id) ON DELETE SET NULL;

-- Backfill house_id from house_members for existing records
UPDATE public.inventory_borrows b
SET house_id = hm.house_id
FROM public.house_members hm
WHERE hm.user_id = b.user_id
  AND b.house_id IS NULL;

-- Index for house-based queries
CREATE INDEX IF NOT EXISTS idx_inventory_borrows_house_id ON public.inventory_borrows(house_id);

-- RLS: housemates can view each other's borrows
DROP POLICY IF EXISTS "Housemates can view borrows" ON public.inventory_borrows;
CREATE POLICY "Housemates can view borrows"
ON public.inventory_borrows FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR house_id IN (
    SELECT house_id FROM public.house_members WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
