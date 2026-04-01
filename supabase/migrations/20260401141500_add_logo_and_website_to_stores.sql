-- Add logo_url and website_url to stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Create storage bucket for stores if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resident-stores', 'resident-stores', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for resident-stores bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'resident-stores');

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resident-stores');

CREATE POLICY "Users can update their own logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resident-stores' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resident-stores' AND (storage.foldername(name))[1] = auth.uid()::text);
