-- Create landing page settings table for admin-manageable content
CREATE TABLE public.landing_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view landing settings (public page)
CREATE POLICY "Anyone can view landing settings"
ON public.landing_settings FOR SELECT
USING (true);

-- Only admins can manage landing settings
CREATE POLICY "Admins can insert landing settings"
ON public.landing_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update landing settings"
ON public.landing_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete landing settings"
ON public.landing_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_landing_settings_updated_at
BEFORE UPDATE ON public.landing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default values
INSERT INTO public.landing_settings (key, value) VALUES
  ('hero_title', 'Selamat Datang di Perumahan Kami'),
  ('hero_subtitle', 'Komunitas yang nyaman, aman, dan asri untuk keluarga Anda'),
  ('hero_image', null),
  ('community_name', 'Perumahan Harmoni Indah'),
  ('address', 'Jl. Harmoni Indah No. 1, Kota Bandung'),
  ('phone', '021-1234567'),
  ('email', 'info@perumahanharmoni.com'),
  ('about_text', 'Perumahan Harmoni Indah adalah komunitas hunian modern yang mengutamakan kenyamanan dan keamanan penghuni. Dengan fasilitas lengkap dan lingkungan yang asri, kami berkomitmen menciptakan tempat tinggal ideal bagi keluarga Anda.'),
  ('show_gallery', 'true'),
  ('show_stats', 'true'),
  ('show_events', 'true'),
  ('show_announcements', 'true');

-- Create storage bucket for landing page images
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-images', 'landing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for landing images
CREATE POLICY "Landing images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-images');

CREATE POLICY "Admins can upload landing images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'landing-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update landing images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'landing-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete landing images"
ON storage.objects FOR DELETE
USING (bucket_id = 'landing-images' AND has_role(auth.uid(), 'admin'::app_role));