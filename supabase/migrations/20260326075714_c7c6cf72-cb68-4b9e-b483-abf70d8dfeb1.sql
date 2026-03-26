
-- Create a security definer function to check if user is menteri_sisdigi
CREATE OR REPLACE FUNCTION public.is_menteri_sisdigi(_user_id uuid)
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
      AND pt.name = 'menteri_sisdigi'
  )
$$;

-- Update houses INSERT policy to include menteri_sisdigi
DROP POLICY IF EXISTS "Admins can insert houses" ON public.houses;
CREATE POLICY "Admins and sisdigi can insert houses"
ON public.houses FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR is_menteri_sisdigi(auth.uid())
);

-- Update houses DELETE policy to include menteri_sisdigi
DROP POLICY IF EXISTS "Admins can delete houses" ON public.houses;
CREATE POLICY "Admins and sisdigi can delete houses"
ON public.houses FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_menteri_sisdigi(auth.uid())
);
