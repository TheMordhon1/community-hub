
-- Final fix for reward schema and trigger
-- Ensures reward_type and usage_limit are properly handled

-- 1. Update reward_items table
ALTER TABLE public.reward_items ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT 'physical_item';
ALTER TABLE public.reward_items ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1;
-- Remove validity_days if it exists (optional, but clean)
-- ALTER TABLE public.reward_items DROP COLUMN IF EXISTS validity_days;

-- 2. Update point_redemptions table
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS redeem_code TEXT;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE;
-- Remove expires_at if it exists
-- ALTER TABLE public.point_redemptions DROP COLUMN IF EXISTS expires_at;

-- 3. Update the trigger function to use usage_limit
CREATE OR REPLACE FUNCTION public.handle_redemption_approval() RETURNS TRIGGER AS $$
DECLARE
    v_usage_limit INTEGER;
BEGIN
    IF (NEW.status = 'approved' AND (OLD.status = 'pending' OR OLD.status IS NULL)) THEN
        -- Get usage_limit from reward item
        SELECT usage_limit INTO v_usage_limit FROM public.reward_items WHERE id = NEW.reward_item_id;
        
        -- Set code and usage limit for this specific redemption
        NEW.redeem_code := public.generate_redeem_code();
        NEW.usage_limit := COALESCE(v_usage_limit, 1);
        NEW.usage_count := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure trigger exists
DROP TRIGGER IF EXISTS trg_redemption_approval ON public.point_redemptions;
CREATE TRIGGER trg_redemption_approval
BEFORE UPDATE ON public.point_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_redemption_approval();

-- 5. Backfill existing records
UPDATE public.reward_items SET reward_type = 'physical_item' WHERE reward_type IS NULL;
UPDATE public.reward_items SET usage_limit = 1 WHERE usage_limit IS NULL;
UPDATE public.point_redemptions SET usage_count = 0 WHERE usage_count IS NULL;
UPDATE public.point_redemptions SET usage_limit = 1 WHERE usage_limit IS NULL AND status = 'approved';
