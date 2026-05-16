
-- Add usage_limit to reward_items
ALTER TABLE public.reward_items ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1;

-- Add usage_count and usage_limit to point_redemptions
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS usage_limit INTEGER DEFAULT 1;

-- Update trigger function to handle usage limit
CREATE OR REPLACE FUNCTION public.handle_redemption_approval() RETURNS TRIGGER AS $$
DECLARE
    v_usage_limit INTEGER;
BEGIN
    IF (NEW.status = 'approved' AND (OLD.status = 'pending' OR OLD.status IS NULL)) THEN
        -- Get usage limit from reward item
        SELECT usage_limit INTO v_usage_limit FROM public.reward_items WHERE id = NEW.reward_item_id;
        
        -- Set code and usage limit
        NEW.redeem_code := public.generate_redeem_code();
        NEW.usage_limit := COALESCE(v_usage_limit, 1);
        NEW.usage_count := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
