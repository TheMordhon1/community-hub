-- Create storage bucket for inventory items
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory', 'inventory', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for inventory items
CREATE POLICY "Anyone can view inventory images"
ON storage.objects FOR SELECT
USING (bucket_id = 'inventory');

CREATE POLICY "Admins and Pengurus can upload inventory images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'inventory' AND 
  (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'pengurus')
  )
);

CREATE POLICY "Admins and Pengurus can update inventory images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'inventory' AND 
  (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'pengurus')
  )
);

CREATE POLICY "Admins and Pengurus can delete inventory images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'inventory' AND 
  (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'pengurus')
  )
);
