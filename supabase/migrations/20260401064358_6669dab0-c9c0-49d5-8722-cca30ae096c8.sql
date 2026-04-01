
-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id UUID NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wa_number TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create store catalog items table
CREATE TABLE public.store_catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_catalog_items ENABLE ROW LEVEL SECURITY;

-- Stores RLS policies
CREATE POLICY "Anyone can view approved stores"
ON public.stores FOR SELECT
TO authenticated
USING (status = 'approved' OR created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "House members can create stores"
ON public.stores FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND is_house_member(auth.uid(), house_id));

CREATE POLICY "Owners can update own pending stores"
ON public.stores FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Owners can delete own stores or admin"
ON public.stores FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Store catalog items RLS policies
CREATE POLICY "Anyone can view catalog of approved stores"
ON public.store_catalog_items FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = store_catalog_items.store_id
  AND (s.status = 'approved' OR s.created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role))
));

CREATE POLICY "Store owners can manage catalog items"
ON public.store_catalog_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.stores s WHERE s.id = store_catalog_items.store_id AND s.created_by = auth.uid()
));

CREATE POLICY "Store owners can update catalog items"
ON public.store_catalog_items FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s WHERE s.id = store_catalog_items.store_id AND s.created_by = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners can delete catalog items"
ON public.store_catalog_items FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s WHERE s.id = store_catalog_items.store_id AND s.created_by = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));
