-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view event images
CREATE POLICY "Event images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow admins and pengurus to upload event images
CREATE POLICY "Admins and Pengurus can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'pengurus'::app_role)
  )
);

-- Allow admins and pengurus to update event images
CREATE POLICY "Admins and Pengurus can update event images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'pengurus'::app_role)
  )
);

-- Allow admins and pengurus to delete event images
CREATE POLICY "Admins and Pengurus can delete event images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images' 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'pengurus'::app_role)
  )
);