INSERT INTO public.landing_settings (key, value)
VALUES
  ('community_name', 'Perumahan Kita'),
  ('hero_title', 'Selamat Datang di Rumah Kita'),
  ('hero_subtitle', 'Yuk, jadi bagian dari komunitas yang hangat, ramah, dan bikin betah. Senang banget bisa kenalan sama kamu!'),
  ('about_text', 'Perumahan kita adalah tempat di mana tetangga bukan cuma sekadar kenal, tapi juga jadi keluarga. Lingkungan yang asri, aman, dan penuh kebersamaan, cocok buat kamu yang lagi cari rumah idaman bareng keluarga tercinta.'),
  ('address', 'Jl. Mawar Indah No. 1, Sejahtera'),
  ('phone', '021-1234-5678'),
  ('email', 'halo@perumahankita.com'),
  ('show_stats', 'true'),
  ('show_gallery', 'true'),
  ('show_events', 'true'),
  ('show_announcements', 'true'),
  ('announcement_max_image_size', '1')
ON CONFLICT (key) DO NOTHING;