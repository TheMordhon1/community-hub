-- Allow Store Owners to view redemptions used at their stores
CREATE POLICY "Store owners can view redemptions used in their store"
ON public.point_redemptions FOR SELECT
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
);
