-- Create house_members table
CREATE TABLE IF NOT EXISTS public.house_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES public.houses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  is_head BOOLEAN DEFAULT false,
  move_in_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.house_members ENABLE ROW LEVEL SECURITY;

-- Migrate existing data from house_residents to house_members
INSERT INTO public.house_members (house_id, user_id, full_name, is_head, move_in_date, created_at)
SELECT 
  hr.house_id, 
  hr.user_id, 
  p.full_name, 
  COALESCE(hr.is_owner, false) as is_head,
  hr.move_in_date,
  hr.created_at
FROM public.house_residents hr
JOIN public.profiles p ON hr.user_id = p.id;

-- Ensure houses with only one resident have that resident as head
WITH single_resident_houses AS (
  SELECT house_id
  FROM public.house_members
  GROUP BY house_id
  HAVING COUNT(*) = 1
)
UPDATE public.house_members
SET is_head = true
WHERE house_id IN (SELECT house_id FROM single_resident_houses);

-- RLS Policies for house_members

-- Anyone can view members of their own house
CREATE POLICY "Users can view members of their own house"
ON public.house_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

-- Users can insert/update members of their own house
CREATE POLICY "Users can manage members of their own house"
ON public.house_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

-- New registration needs to see unlinked members to claim them
CREATE POLICY "Potential residents can see unlinked members"
ON public.house_members FOR SELECT
TO authenticated
USING (user_id IS NULL);

-- Update RLS for other tables that used house_residents
DROP POLICY IF EXISTS "Residents can update their own house status" ON public.houses;
CREATE POLICY "Residents can update their own house status" ON public.houses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.house_members
      WHERE house_members.house_id = public.houses.id
      AND house_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments"
ON public.payments FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'pengurus') OR
  (
    auth.uid() = submitted_by AND 
    EXISTS (
      SELECT 1 FROM public.house_members 
      WHERE house_id = payments.house_id AND user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can view payments for their house" ON public.payments;
CREATE POLICY "Users can view payments for their house" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.house_members WHERE house_members.house_id = payments.house_id AND house_members.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

-- Create updated_at trigger
CREATE TRIGGER update_house_members_updated_at BEFORE UPDATE ON public.house_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle head of household logic
CREATE OR REPLACE FUNCTION public.handle_house_head_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a new head, unset any existing head in the same house
  IF NEW.is_head = true THEN
    UPDATE public.house_members
    SET is_head = false
    WHERE house_id = NEW.house_id AND id <> NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_house_head_change
  BEFORE UPDATE OF is_head ON public.house_members
  FOR EACH ROW
  WHEN (NEW.is_head = true AND OLD.is_head = false)
  EXECUTE FUNCTION public.handle_house_head_change();

-- Also handle auto-designating head on first member insertion
CREATE OR REPLACE FUNCTION public.auto_designate_head()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.house_members WHERE house_id = NEW.house_id) THEN
    NEW.is_head := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_house_member_inserted
  BEFORE INSERT ON public.house_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_designate_head();
