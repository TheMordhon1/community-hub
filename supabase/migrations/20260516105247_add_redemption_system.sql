
-- Create reward_items table
CREATE TABLE IF NOT EXISTS public.reward_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER NOT NULL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create point_redemptions table
CREATE TABLE IF NOT EXISTS public.point_redemptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reward_item_id UUID NOT NULL REFERENCES public.reward_items(id) ON DELETE CASCADE,
    points_spent INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processed, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.reward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_redemptions ENABLE ROW LEVEL SECURITY;

-- Reward items are readable by everyone
CREATE POLICY "Reward items are readable by everyone" ON public.reward_items
    FOR SELECT USING (true);

-- Reward items manageable by admins and pengurus
DROP POLICY IF EXISTS "Admins can manage reward items" ON public.reward_items;
CREATE POLICY "Admins can manage reward items" ON public.reward_items
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'pengurus')));

-- Redemptions readable by user and admin
DROP POLICY IF EXISTS "Users can see their own redemptions" ON public.point_redemptions;
CREATE POLICY "Users can see their own redemptions" ON public.point_redemptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can see all redemptions" ON public.point_redemptions;
CREATE POLICY "Admins can see all redemptions" ON public.point_redemptions
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'pengurus')));

-- Insert initial monthly payment rule
INSERT INTO public.gamification_rules (action_key, action_name, points, description)
VALUES 
    ('monthly_payment', 'Pembayaran Iuran Bulanan', 100, 'Mendapatkan poin setiap kali membayar iuran bulanan tepat waktu'),
    ('profile_update', 'Pembaruan Profil', 50, 'Mendapatkan poin saat melengkapi data profil'),
    ('house_data', 'Pembaruan Data Rumah', 50, 'Mendapatkan poin saat memperbarui status hunian rumah'),
    ('family_member_add', 'Tambah Anggota Keluarga', 25, 'Mendapatkan poin saat mendaftarkan anggota keluarga baru'),
    ('house_location_update', 'Pembaruan Lokasi Rumah', 100, 'Mendapatkan poin saat menandai lokasi rumah di peta'),
    ('store_creation', 'Buka Toko UMKM', 200, 'Mendapatkan poin saat mendaftarkan toko UMKM baru')
ON CONFLICT (action_key) DO UPDATE SET points = EXCLUDED.points;

-- Initial reward items
INSERT INTO public.reward_items (name, description, points_cost, stock, reward_type, usage_limit)
VALUES 
    ('Voucher Belanja Rp 50.000', 'Voucher belanja di minimarket terdekat', 500, 10, 'voucher', 1),
    ('Kaos Komunitas', 'Kaos keren edisi terbatas', 1000, 5, 'physical_item', 1),
    ('Bebas Iuran 1 Bulan', 'Gratis iuran bulanan untuk 1 bulan ke depan', 2000, 100, 'ipl_discount', 1)
ON CONFLICT DO NOTHING;
