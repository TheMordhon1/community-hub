ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS store_claimed_at TIMESTAMP WITH TIME ZONE;

-- Add UPDATE policy for store owners to claim redemptions
CREATE POLICY "Store owners can update redemptions used in their store"
ON public.point_redemptions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = point_redemptions.used_in_id
        AND (
            stores.created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.house_members
                WHERE house_members.house_id = stores.house_id
                AND house_members.user_id = auth.uid()
                AND house_members.status = 'approved'
            )
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.stores
        WHERE stores.id = point_redemptions.used_in_id
        AND (
            stores.created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.house_members
                WHERE house_members.house_id = stores.house_id
                AND house_members.user_id = auth.uid()
                AND house_members.status = 'approved'
            )
        )
    )
);
