
-- Add reaction_type column to announcement_likes
ALTER TABLE public.announcement_likes ADD COLUMN reaction_type text DEFAULT 'heart';

-- Drop the old unique constraint
ALTER TABLE public.announcement_likes DROP CONSTRAINT IF EXISTS announcement_likes_announcement_id_user_id_key;

-- Add new unique constraint including reaction_type
ALTER TABLE public.announcement_likes ADD CONSTRAINT announcement_likes_announcement_id_user_id_reaction_type_key UNIQUE (announcement_id, user_id, reaction_type);

-- Update existing policy names for clarity (optional)
-- The existing policies should still work fine as they don't depend on the constraint name
