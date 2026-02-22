-- 1. First, define the SECURITY DEFINER functions so they can be used in policies
-- These bypass RLS, thus preventing infinite recursion.

CREATE OR REPLACE FUNCTION public.get_user_house_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT house_id
  FROM public.house_members
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.house_has_voted(_poll_id uuid, _house_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.poll_votes pv
    JOIN public.house_members hm ON hm.user_id = pv.user_id
    WHERE pv.poll_id = _poll_id
      AND hm.house_id = _house_id
  )
$$;

-- 2. Clean up old policies
DROP POLICY IF EXISTS "Users can view members of their own house" ON public.house_members;
DROP POLICY IF EXISTS "Users can manage members of their own house" ON public.house_members;
DROP POLICY IF EXISTS "Potential residents can see unlinked members" ON public.house_members;
DROP POLICY IF EXISTS "Users can view house members" ON public.house_members;
DROP POLICY IF EXISTS "Users can manage house members" ON public.house_members;

-- Ensure all old payment policies are gone
DROP POLICY IF EXISTS "Users can insert payments for their house" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments for their house" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;

-- 3. Create fresh, non-recursive policies for house_members

-- View policy: Simple true check for authenticated users (directory access)
CREATE POLICY "Users can view house members"
ON public.house_members FOR SELECT
TO authenticated
USING (true);

-- Manage policy: Use the helper function to check house membership without recursing
CREATE POLICY "Users can manage members of their own house"
ON public.house_members FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
  OR house_id = public.get_user_house_id(auth.uid())
);

-- 4. Recreate payment policies using house_members

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

CREATE POLICY "Users can view payments for their house" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.house_members WHERE house_members.house_id = payments.house_id AND house_members.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
