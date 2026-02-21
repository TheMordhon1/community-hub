-- Add related_url column to announcements
ALTER TABLE public.announcements ADD COLUMN related_url TEXT;

-- Update RLS policies to include the new column (though existing ones usually cover all columns)
-- No changes needed to RLS as they use select * or mention specific roles/conditions, not columns.
