-- Create storage bucket for competition avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('competition-avatars', 'competition-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow public read access to competition avatars
CREATE POLICY "competition-avatars Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'competition-avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY "competition-avatars Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'competition-avatars' AND 
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "competition-avatars Authenticated Update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'competition-avatars' AND 
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "competition-avatars Authenticated Delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'competition-avatars' AND 
  auth.role() = 'authenticated'
);
