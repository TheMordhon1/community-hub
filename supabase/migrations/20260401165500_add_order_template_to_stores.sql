-- Add order_template to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS order_template TEXT;

-- Update RLS policies is already handled by previous migration (house members can update)
