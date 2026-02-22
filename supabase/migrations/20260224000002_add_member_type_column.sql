-- Add member_type column to house_members table
ALTER TABLE public.house_members 
ADD COLUMN IF NOT EXISTS member_type text;

-- Add check constraint for valid member types
-- Using a check constraint instead of a custom type for easier modification if needed
ALTER TABLE public.house_members
ADD CONSTRAINT house_members_member_type_check 
CHECK (member_type IN ('suami', 'istri', 'anak', 'orang_tua', 'saudara', 'asisten', 'single'));

-- Add comment for clarity
COMMENT ON COLUMN public.house_members.member_type IS 'Role within the household (suami, istri, anak, etc.)';
