-- Create pengurus_titles table for dynamic title management
CREATE TABLE public.pengurus_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  has_finance_access boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pengurus_titles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view pengurus_titles"
ON public.pengurus_titles FOR SELECT
USING (true);

CREATE POLICY "Admins can insert pengurus_titles"
ON public.pengurus_titles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pengurus_titles"
ON public.pengurus_titles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pengurus_titles"
ON public.pengurus_titles FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_pengurus_titles_updated_at
BEFORE UPDATE ON public.pengurus_titles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial seed data
INSERT INTO public.pengurus_titles (name, display_name, has_finance_access, order_index) VALUES
('ketua', 'Ketua', false, 1),
('wakil_ketua', 'Wakil Ketua', false, 2),
('sekretaris', 'Sekretaris', false, 3),
('bendahara', 'Bendahara', true, 4);

-- Add title_id column to user_roles
ALTER TABLE public.user_roles ADD COLUMN title_id uuid REFERENCES public.pengurus_titles(id) ON DELETE SET NULL;

-- Migrate existing data from enum title to title_id
UPDATE public.user_roles ur
SET title_id = pt.id
FROM public.pengurus_titles pt
WHERE ur.title::text = pt.name;

-- Create helper function to check finance access
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.pengurus_titles pt ON ur.title_id = pt.id
    WHERE ur.user_id = _user_id
      AND pt.has_finance_access = true
  )
$$;

-- Update finance_records INSERT policy to use new function
DROP POLICY IF EXISTS "Bendahara and Admin can insert finance records" ON public.finance_records;
CREATE POLICY "Bendahara and Admin can insert finance records"
ON public.finance_records FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'pengurus'::app_role) AND has_finance_access(auth.uid()))
);

-- Update finance_records UPDATE policy to use new function
DROP POLICY IF EXISTS "Bendahara and Admin can update finance records" ON public.finance_records;
CREATE POLICY "Bendahara and Admin can update finance records"
ON public.finance_records FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  (has_role(auth.uid(), 'pengurus'::app_role) AND has_finance_access(auth.uid()))
);