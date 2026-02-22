-- Migration: Fix RLS recursion in house_members
-- This migration introduces helper functions that run with SECURITY DEFINER
-- to avoid recursion when checking house membership and head of household status.

-- 1. Helper to check if a user is an approved member of a house
CREATE OR REPLACE FUNCTION public.is_approved_house_member(_user_id UUID, _house_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = _house_id
    AND hm.user_id = _user_id
    AND hm.status = 'approved'
  );
END;
$$;

-- 2. Helper to check if a user is the head of a specific house
CREATE OR REPLACE FUNCTION public.is_house_head(_user_id UUID, _house_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = _house_id
    AND hm.user_id = _user_id
    AND hm.is_head = true
    AND hm.status = 'approved'
  );
END;
$$;

-- 3. Update house_members SELECT policy
DROP POLICY IF EXISTS "Users can view members of their own house" ON public.house_members;
CREATE POLICY "Users can view members of their own house"
ON public.house_members FOR SELECT
TO authenticated
USING (
  -- Users can see anyone in their house if they are approved
  public.is_approved_house_member(auth.uid(), house_id)
  -- Or they can see their own requests (even if pending/rejected)
  OR user_id = auth.uid()
  -- Or admins and pengurus can see everyone
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

-- 4. Update house_members ALL (manage) policy
DROP POLICY IF EXISTS "Users can manage members of their own house" ON public.house_members;
CREATE POLICY "Users can manage members of their own house"
ON public.house_members FOR ALL
TO authenticated
USING (
  -- KK can manage everyone in their house
  public.is_house_head(auth.uid(), house_id)
  -- Users can delete their own records (cancel requests)
  OR (user_id = auth.uid() AND (status = 'pending' OR status = 'rejected'))
  -- Admins and pengurus can manage everyone
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
)
WITH CHECK (
  -- KK can manage everyone in their house
  public.is_house_head(auth.uid(), house_id)
  -- Users can manage their own records (if pending/rejected status is kept or transitioned correctly)
  OR (user_id = auth.uid() AND (status = 'pending' OR status = 'rejected'))
  -- Admins and pengurus can manage everyone
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
