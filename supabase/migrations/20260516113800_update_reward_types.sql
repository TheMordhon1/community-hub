
-- Add reward_type to reward_items
ALTER TABLE public.reward_items ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT 'physical_item'; -- voucher, ipl_discount, physical_item

-- Update existing items to physical_item or voucher based on name
UPDATE public.reward_items SET reward_type = 'voucher' WHERE name ILIKE '%voucher%';
UPDATE public.reward_items SET reward_type = 'ipl_discount' WHERE name ILIKE '%IPL%' OR name ILIKE '%iuran%';

-- Add a column to track if a redemption has been used
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS used_in_id UUID; -- ID of the store/payment where it was used
