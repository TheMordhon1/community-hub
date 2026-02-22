-- FINAL CONSOLIDATED RLS RECURSION FIX

-- 1. DROP ALL POTENTIALLY RECURSIVE POLICIES
-- Clean up house_members
DROP POLICY IF EXISTS "Users can view members of their own house" ON public.house_members;
DROP POLICY IF EXISTS "Users can manage members of their own house" ON public.house_members;
DROP POLICY IF EXISTS "Potential residents can see unlinked members" ON public.house_members;
DROP POLICY IF EXISTS "Users can view house members" ON public.house_members;
DROP POLICY IF EXISTS "Users can manage house members" ON public.house_members;

-- Clean up user_roles (The usual root of all RLS evil)
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Clean up payments
DROP POLICY IF EXISTS "Users can insert payments for their house" ON public.payments;
DROP POLICY IF EXISTS "Users can view payments for their house" ON public.payments;
DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;

-- 2. REDEFINE HELPER FUNCTIONS AS PLPGSQL SECURITY DEFINER
-- Using plpgsql ensures they are not inlined and respect the SECURITY DEFINER attribute properly.

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_house_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _house_id uuid;
BEGIN
  SELECT house_id INTO _house_id
  FROM public.house_members
  WHERE user_id = _user_id
  LIMIT 1;
  RETURN _house_id;
END;
$$;

-- Helper to check if user is a member of a specific house (non-recursive)
CREATE OR REPLACE FUNCTION public.is_house_member(_user_id uuid, _house_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.house_members
    WHERE user_id = _user_id
      AND house_id = _house_id
  );
END;
$$;

-- 3. APPLY FRESH, NON-RECURSIVE POLICIES

-- User Roles: Simple non-recursive policies
CREATE POLICY "user_roles_select_policy" ON public.user_roles 
FOR SELECT TO authenticated 
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "user_roles_admin_manage_policy" ON public.user_roles 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- House Members: Simple non-recursive policies
CREATE POLICY "house_members_select_all" ON public.house_members 
FOR SELECT TO authenticated 
USING (true); -- Directory access is fine

CREATE POLICY "house_members_manage_policy" ON public.house_members 
FOR ALL TO authenticated 
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
  OR house_id = public.get_user_house_id(auth.uid())
);

-- Payments: Using non-recursive help functions
CREATE POLICY "payments_select_policy" ON public.payments 
FOR SELECT TO authenticated 
USING (
  public.is_house_member(auth.uid(), house_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

CREATE POLICY "payments_insert_policy" ON public.payments 
FOR INSERT TO authenticated 
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'pengurus') 
  OR (
    auth.uid() = submitted_by 
    AND public.is_house_member(auth.uid(), house_id)
  )
);

-- Houses: Update policy
DROP POLICY IF EXISTS "Residents can update their own house status" ON public.houses;
CREATE POLICY "houses_update_policy" ON public.houses
FOR UPDATE TO authenticated
USING (
  public.is_house_member(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin')
);
