
-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read settings" ON public.app_settings
    FOR SELECT USING (true);

-- Only Admins and Pengurus can manage settings
CREATE POLICY "Admins and Pengurus can manage settings" ON public.app_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'pengurus')
        )
    );

-- Insert default gamification setting
INSERT INTO public.app_settings (key, value, description)
VALUES ('gamification_enabled', 'true'::jsonb, 'Toggle global gamification feature (points and rewards)')
ON CONFLICT (key) DO NOTHING;
