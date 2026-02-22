-- Add status column to house_members
ALTER TABLE public.house_members 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update RLS policies for house_members to be more precise
DROP POLICY IF EXISTS "Users can view members of their own house" ON public.house_members;
CREATE POLICY "Users can view members of their own house"
ON public.house_members FOR SELECT
TO authenticated
USING (
  -- Users can see anyone in their house if they are approved
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
    AND hm.status = 'approved'
  )
  -- Or they can see their own requests (even if pending/rejected)
  OR user_id = auth.uid()
  -- Or admins and pengurus can see everyone
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);

DROP POLICY IF EXISTS "Users can manage members of their own house" ON public.house_members;
CREATE POLICY "Users can manage members of their own house"
ON public.house_members FOR ALL
TO authenticated
USING (
  -- KK can manage everyone in their house
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
    AND hm.is_head = true
    AND hm.status = 'approved'
  )
  -- Users can delete their own records (cancel requests)
  OR (user_id = auth.uid() AND (status = 'pending' OR status = 'rejected'))
  -- Admins and pengurus can manage everyone
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
)
WITH CHECK (
  -- Same logic for check
  EXISTS (
    SELECT 1 FROM public.house_members hm
    WHERE hm.house_id = public.house_members.house_id
    AND hm.user_id = auth.uid()
    AND hm.is_head = true
    AND hm.status = 'approved'
  )
  OR (user_id = auth.uid() AND (status = 'pending' OR status = 'rejected'))
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'pengurus')
);
