-- Create menus table
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  show_in_sidebar_main boolean NOT NULL DEFAULT false,
  show_in_sidebar_pengurus boolean NOT NULL DEFAULT false,
  show_in_sidebar_admin boolean NOT NULL DEFAULT false,
  show_in_quick_menu boolean NOT NULL DEFAULT false,
  show_in_pengurus_menu boolean NOT NULL DEFAULT false,
  show_in_admin_menu boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  color text DEFAULT 'text-primary',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active menus"
ON public.menus FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert menus"
ON public.menus FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update menus"
ON public.menus FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete menus"
ON public.menus FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_menus_updated_at
BEFORE UPDATE ON public.menus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing menus
INSERT INTO public.menus (name, title, url, icon, is_active, show_in_sidebar_main, show_in_quick_menu, order_index, color) VALUES
('dashboard', 'Dashboard', '/dashboard', 'Home', true, true, false, 1, 'text-primary'),
('announcements', 'Pengumuman', '/announcements', 'FileText', true, true, true, 2, 'text-primary'),
('events', 'Acara', '/events', 'Calendar', true, true, true, 3, 'text-accent'),
('complaints', 'Pengaduan', '/complaints', 'MessageSquare', true, true, true, 4, 'text-warning'),
('payments', 'IPL', '/payments', 'CreditCard', true, true, true, 5, 'text-success'),
('polls', 'Polling', '/polls', 'Vote', true, true, true, 6, 'text-info'),
('organization', 'Struktur Organisasi', '/organization', 'Users', true, true, false, 7, 'text-primary'),
('house_map', 'Peta Rumah', '/house-map', 'Map', true, true, true, 8, 'text-success');

-- Pengurus menus
INSERT INTO public.menus (name, title, url, icon, is_active, show_in_sidebar_pengurus, show_in_pengurus_menu, order_index, color) VALUES
('manage_houses', 'Kelola Rumah', '/admin/houses', 'Building2', true, true, false, 1, 'text-primary'),
('finance', 'Keuangan', '/finance', 'Wallet', true, true, true, 2, 'text-success');

-- Admin menus
INSERT INTO public.menus (name, title, url, icon, is_active, show_in_sidebar_admin, show_in_admin_menu, order_index, color) VALUES
('manage_users', 'Kelola Warga', '/admin/users', 'Users', true, true, true, 1, 'text-secondary'),
('manage_titles', 'Kelola Jabatan', '/admin/titles', 'BadgeCheck', true, true, false, 2, 'text-primary'),
('manage_menus', 'Kelola Menu', '/admin/menus', 'Menu', true, true, false, 3, 'text-primary'),
('settings', 'Pengaturan', '/admin/settings', 'Settings', true, true, true, 4, 'text-muted-foreground');