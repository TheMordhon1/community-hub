
-- Drop old email-based policies
DROP POLICY IF EXISTS "Admins can manage gamification rules" ON public.gamification_rules;
DROP POLICY IF EXISTS "Admins can manage reward items" ON public.reward_items;
DROP POLICY IF EXISTS "Admins can see all redemptions" ON public.point_redemptions;

-- Create new role-based policies
-- Check for 'admin' or 'pengurus' role in user_roles table
CREATE POLICY "Admins and Pengurus can manage gamification rules" ON public.gamification_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );

CREATE POLICY "Admins and Pengurus can manage reward items" ON public.reward_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );

CREATE POLICY "Admins and Pengurus can manage point redemptions" ON public.point_redemptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );
