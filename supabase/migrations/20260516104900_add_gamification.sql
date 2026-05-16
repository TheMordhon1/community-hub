
-- Add points column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Create gamification_rules table
CREATE TABLE IF NOT EXISTS public.gamification_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_key TEXT UNIQUE NOT NULL,
    action_name TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_point_history table to track actions and points
CREATE TABLE IF NOT EXISTS public.user_point_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    points_awarded INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, action_key) -- Ensures "first action" logic
);

-- Add RLS policies
ALTER TABLE public.gamification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_point_history ENABLE ROW LEVEL SECURITY;

-- Rules are readable by everyone
CREATE POLICY "Rules are readable by everyone" ON public.gamification_rules
    FOR SELECT USING (true);

-- Rules are manageable by admins and pengurus
DROP POLICY IF EXISTS "Admins can manage rules" ON public.gamification_rules;
CREATE POLICY "Admins can manage rules" ON public.gamification_rules
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'pengurus')));

-- Point history is readable by the user themselves
CREATE POLICY "Users can see their own point history" ON public.user_point_history
    FOR SELECT USING (auth.uid() = user_id);

-- Insert initial rules
INSERT INTO public.gamification_rules (action_key, action_name, points, description)
VALUES 
    ('profile_update', 'Update Profil Pertama Kali', 10, 'Mendapatkan poin saat pertama kali melengkapi data profil'),
    ('house_data', 'Input Data Rumah', 50, 'Mendapatkan poin saat pertama kali mengisi data rumah'),
    ('competition_join', 'Ikut Kompetisi', 20, 'Mendapatkan poin saat pertama kali mendaftar kompetisi'),
    ('poll_vote', 'Ikut Voting', 5, 'Mendapatkan poin saat pertama kali memberikan suara pada polling')
ON CONFLICT (action_key) DO NOTHING;
