
-- Add validity_days to reward_items
ALTER TABLE public.reward_items ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT 30;

-- Add redeem_code and expires_at to point_redemptions
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS redeem_code TEXT;
ALTER TABLE public.point_redemptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create a function to generate a random code
CREATE OR REPLACE FUNCTION public.generate_redeem_code() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to handle approval
CREATE OR REPLACE FUNCTION public.handle_redemption_approval() RETURNS TRIGGER AS $$
DECLARE
    v_validity INTEGER;
BEGIN
    IF (NEW.status = 'approved' AND (OLD.status = 'pending' OR OLD.status IS NULL)) THEN
        -- Get validity days from reward item
        SELECT validity_days INTO v_validity FROM public.reward_items WHERE id = NEW.reward_item_id;
        
        -- Set code and expiry
        NEW.redeem_code := public.generate_redeem_code();
        NEW.expires_at := timezone('utc'::text, now()) + (COALESCE(v_validity, 30) || ' days')::interval;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_redemption_approval
BEFORE UPDATE ON public.point_redemptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_redemption_approval();

