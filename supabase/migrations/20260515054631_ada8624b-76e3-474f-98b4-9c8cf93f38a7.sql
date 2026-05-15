
-- Announcement categories table
CREATE TABLE public.announcement_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcement_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view announcement categories"
  ON public.announcement_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins and Pengurus can insert announcement categories"
  ON public.announcement_categories FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can update announcement categories"
  ON public.announcement_categories FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can delete announcement categories"
  ON public.announcement_categories FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE TRIGGER update_announcement_categories_updated_at
  BEFORE UPDATE ON public.announcement_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.announcement_categories (name, order_index) VALUES
  ('Tips', 0), ('Informasi', 1), ('Umum', 2);

-- RAB documents table
CREATE TABLE public.rab_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  pdf_url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rab_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view rab documents"
  ON public.rab_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and Pengurus can insert rab documents"
  ON public.rab_documents FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can update rab documents"
  ON public.rab_documents FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can delete rab documents"
  ON public.rab_documents FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE TRIGGER update_rab_documents_updated_at
  BEFORE UPDATE ON public.rab_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for RAB PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('rab-documents', 'rab-documents', true);

CREATE POLICY "Anyone can view rab pdfs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rab-documents');

CREATE POLICY "Pengurus and Admins can upload rab pdfs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rab-documents' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role))
  );

CREATE POLICY "Pengurus and Admins can update rab pdfs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'rab-documents' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role))
  );

CREATE POLICY "Pengurus and Admins can delete rab pdfs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rab-documents' AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role))
  );
