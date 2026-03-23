
-- Revert to single reaction per user per announcement
-- First, keep only the latest reaction for each user/announcement pair to avoid constraint violations
DELETE FROM public.announcement_likes a
USING public.announcement_likes b
WHERE a.announcement_id = b.announcement_id
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

-- Drop the multi-reaction unique constraint
ALTER TABLE public.announcement_likes DROP CONSTRAINT IF EXISTS announcement_likes_announcement_id_user_id_reaction_type_key;

-- Add (or restore) the unique constraint on (announcement_id, user_id)
ALTER TABLE public.announcement_likes ADD CONSTRAINT announcement_likes_announcement_id_user_id_key UNIQUE (announcement_id, user_id);
