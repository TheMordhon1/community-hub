-- Create storage bucket for announcement images
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow public read access to announcement images
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcement-images');

-- Allow admin and pengurus to upload images
CREATE POLICY "Admin and Pengurus Can Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcement-images' AND 
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'pengurus')
    )
  )
);

-- Allow admin and pengurus to update their images
CREATE POLICY "Admin and Pengurus Can Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'announcement-images' AND 
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'pengurus')
    )
  )
);

-- Allow admin and pengurus to delete their images
CREATE POLICY "Admin and Pengurus Can Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'announcement-images' AND 
  (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role IN ('admin', 'pengurus')
    )
  )
);
