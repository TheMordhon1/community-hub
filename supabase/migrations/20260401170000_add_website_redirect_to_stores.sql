-- Add use_external_website to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS use_external_website BOOLEAN DEFAULT false;
