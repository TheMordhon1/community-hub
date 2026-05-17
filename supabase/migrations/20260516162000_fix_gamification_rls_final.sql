-- Definitive RLS Fix for Gamification Tables
-- Ensures Admin and Pengurus can manage everything

DO $$ 
BEGIN
    -- 1. gamification_rules
    DROP POLICY IF EXISTS "Admins and Pengurus can manage gamification rules" ON public.gamification_rules;
    DROP POLICY IF EXISTS "Admins can manage rules" ON public.gamification_rules;
    DROP POLICY IF EXISTS "Rules are readable by everyone" ON public.gamification_rules;
    
    CREATE POLICY "Anyone can view gamification rules" 
        ON public.gamification_rules FOR SELECT USING (true);
        
    CREATE POLICY "Admins and Pengurus can manage gamification rules" 
        ON public.gamification_rules FOR ALL 
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        );

    -- 2. reward_items
    DROP POLICY IF EXISTS "Admins and Pengurus can manage reward items" ON public.reward_items;
    DROP POLICY IF EXISTS "Admins can manage reward items" ON public.reward_items;
    DROP POLICY IF EXISTS "Reward items are readable by everyone" ON public.reward_items;

    CREATE POLICY "Anyone can view reward items" 
        ON public.reward_items FOR SELECT USING (true);

    CREATE POLICY "Admins and Pengurus can manage reward items" 
        ON public.reward_items FOR ALL 
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        );

    -- 3. point_redemptions
    DROP POLICY IF EXISTS "Admins and Pengurus can manage point redemptions" ON public.point_redemptions;
    DROP POLICY IF EXISTS "Admins can see all redemptions" ON public.point_redemptions;
    DROP POLICY IF EXISTS "Users can see their own redemptions" ON public.point_redemptions;

    CREATE POLICY "Users can view and create own redemptions" 
        ON public.point_redemptions FOR ALL 
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Admins and Pengurus can manage all redemptions" 
        ON public.point_redemptions FOR ALL 
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        );

    -- 4. user_point_history
    DROP POLICY IF EXISTS "Users can see their own point history" ON public.user_point_history;
    
    CREATE POLICY "Users can view own point history" 
        ON public.user_point_history FOR SELECT 
        TO authenticated
        USING (auth.uid() = user_id);

    CREATE POLICY "Admins and Pengurus can view all point history" 
        ON public.user_point_history FOR SELECT 
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles 
                WHERE user_id = auth.uid() 
                AND role IN ('admin', 'pengurus')
            )
        );
END $$;
