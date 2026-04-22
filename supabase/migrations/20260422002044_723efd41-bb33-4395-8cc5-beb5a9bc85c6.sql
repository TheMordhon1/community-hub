
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Umum';

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_category_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_category_check
  CHECK (category IN ('Tips', 'Informasi', 'Umum'));
