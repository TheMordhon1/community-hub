-- Add max_vote_changes to polls table (null = unlimited, 0 = no changes allowed, 1+ = can change that many times)
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS max_vote_changes integer DEFAULT NULL;

-- Add change_count to poll_votes table to track how many times user has changed vote
ALTER TABLE public.poll_votes ADD COLUMN IF NOT EXISTS change_count integer NOT NULL DEFAULT 0;

-- Drop the restrictive update policy and create a new one that allows changes based on limit
DROP POLICY IF EXISTS "Users cannot update votes" ON public.poll_votes;

-- Create a function to check if user can change vote
CREATE OR REPLACE FUNCTION public.can_change_vote(_poll_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT 
        CASE 
          -- If max_vote_changes is NULL, unlimited changes allowed
          WHEN p.max_vote_changes IS NULL THEN true
          -- Otherwise check if user has changes remaining
          ELSE COALESCE(pv.change_count, 0) < p.max_vote_changes
        END
      FROM public.polls p
      LEFT JOIN public.poll_votes pv ON pv.poll_id = p.id AND pv.user_id = _user_id
      WHERE p.id = _poll_id
    ),
    false
  )
$$;

-- Create function to check remaining vote changes for a user
CREATE OR REPLACE FUNCTION public.get_remaining_vote_changes(_poll_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    CASE 
      WHEN p.max_vote_changes IS NULL THEN -1  -- -1 means unlimited
      ELSE GREATEST(0, p.max_vote_changes - COALESCE(pv.change_count, 0))
    END
  FROM public.polls p
  LEFT JOIN public.poll_votes pv ON pv.poll_id = p.id AND pv.user_id = _user_id
  WHERE p.id = _poll_id
$$;

-- Policy: Users can update their own vote if poll allows and they have changes remaining
CREATE POLICY "Users can update own vote if allowed" 
ON public.poll_votes 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND can_change_vote(poll_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.polls 
    WHERE id = poll_id 
    AND is_active = true
    AND (ends_at IS NULL OR ends_at > now())
  )
);

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.can_change_vote(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_remaining_vote_changes(uuid, uuid) TO authenticated;