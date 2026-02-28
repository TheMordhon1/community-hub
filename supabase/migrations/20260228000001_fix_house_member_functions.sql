-- Fix RLS helper functions to filter by approved status only
-- This ensures only approved house members can update their house's data
-- (e.g., occupancy_status, vacancy_reason, estimated_return_date)

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
    AND status = 'approved'
  LIMIT 1;
  RETURN _house_id;
END;
$$;

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
      AND status = 'approved'
  );
END;
$$;
