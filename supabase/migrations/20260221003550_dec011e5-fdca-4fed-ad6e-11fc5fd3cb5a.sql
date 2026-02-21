
-- Inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'good',
  image_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Borrow requests table
CREATE TABLE public.inventory_borrows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  borrow_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  return_date TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Borrow items (many-to-many between borrows and inventory)
CREATE TABLE public.inventory_borrow_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  borrow_id UUID NOT NULL REFERENCES public.inventory_borrows(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_borrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_borrow_items ENABLE ROW LEVEL SECURITY;

-- Inventory items policies
CREATE POLICY "Anyone can view inventory items"
ON public.inventory_items FOR SELECT USING (true);

CREATE POLICY "Admins and Pengurus can insert inventory items"
ON public.inventory_items FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can update inventory items"
ON public.inventory_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins and Pengurus can delete inventory items"
ON public.inventory_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

-- Borrow requests policies
CREATE POLICY "Users can view own borrows or admins/pengurus can view all"
ON public.inventory_borrows FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Authenticated users can create borrow requests"
ON public.inventory_borrows FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and Pengurus can update borrow requests"
ON public.inventory_borrows FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins can delete borrow requests"
ON public.inventory_borrows FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Borrow items policies
CREATE POLICY "Anyone can view borrow items for accessible borrows"
ON public.inventory_borrow_items FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert borrow items"
ON public.inventory_borrow_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Pengurus can update borrow items"
ON public.inventory_borrow_items FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admins can delete borrow items"
ON public.inventory_borrow_items FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_borrows_updated_at
BEFORE UPDATE ON public.inventory_borrows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
