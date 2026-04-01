-- Add is_open and status_changed_at to stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT now();

-- Update status_changed_at automatically when is_open changes
-- (Optional but helpful, or we can just do it from the client)
-- Let's do it via client for simplicity in this environment.
