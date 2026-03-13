
-- Create finance_categories table for dynamic categories
CREATE TABLE public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('income', 'outcome')),
  created_by uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view categories
CREATE POLICY "Anyone can view finance categories"
  ON public.finance_categories FOR SELECT
  TO authenticated
  USING (true);

-- Admin or finance access can insert categories
CREATE POLICY "Admin or Finance can insert categories"
  ON public.finance_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'pengurus'::app_role) AND has_finance_access(auth.uid()))
  );

-- Admin or finance access can delete categories
CREATE POLICY "Admin or Finance can delete categories"
  ON public.finance_categories FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'pengurus'::app_role) AND has_finance_access(auth.uid()))
  );

-- Seed default categories
INSERT INTO public.finance_categories (name, type) VALUES
  ('iuran', 'income'),
  ('donasi', 'income'),
  ('Pendapatan Lainnya', 'income'),
  ('kegiatan', 'outcome'),
  ('keamanan', 'outcome'),
  ('kebersihan', 'outcome'),
  ('perbaikan', 'outcome'),
  ('acara', 'outcome'),
  ('operasional', 'outcome'),
  ('Pengeluaran Lainnya', 'outcome');
