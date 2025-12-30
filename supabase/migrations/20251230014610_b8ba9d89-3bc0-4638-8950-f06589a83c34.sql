-- Add vote_type enum to polls
CREATE TYPE public.poll_vote_type AS ENUM ('per_account', 'per_house');

-- Add vote_type column to polls table
ALTER TABLE public.polls ADD COLUMN vote_type public.poll_vote_type NOT NULL DEFAULT 'per_account';

-- Remove house_number from profiles (will use house_residents linking table instead)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS house_number;

-- Create function to check if house already voted on a poll
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
    JOIN public.house_residents hr ON hr.user_id = pv.user_id
    WHERE pv.poll_id = _poll_id
      AND hr.house_id = _house_id
  )
$$;

-- Create function to get user's house_id
CREATE OR REPLACE FUNCTION public.get_user_house_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT house_id
  FROM public.house_residents
  WHERE user_id = _user_id
  LIMIT 1
$$;