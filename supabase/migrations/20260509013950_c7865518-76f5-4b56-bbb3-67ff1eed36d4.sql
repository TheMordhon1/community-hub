ALTER TABLE public.emergency_contacts
ADD COLUMN IF NOT EXISTS price_min numeric,
ADD COLUMN IF NOT EXISTS price_max numeric,
ADD COLUMN IF NOT EXISTS price_unit text;