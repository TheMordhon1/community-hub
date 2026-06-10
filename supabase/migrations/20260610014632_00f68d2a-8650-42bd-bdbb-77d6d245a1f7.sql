
-- Add paid event fields to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_paid_event boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS participation_fee numeric(12,2);

-- Per event+house payment tracking
CREATE TABLE IF NOT EXISTS public.event_house_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  house_id uuid NOT NULL REFERENCES public.houses(id) ON DELETE CASCADE,
  amount numeric(12,2),
  notes text,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, house_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_house_payments TO authenticated;
GRANT ALL ON public.event_house_payments TO service_role;

ALTER TABLE public.event_house_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view event house payments"
  ON public.event_house_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and pengurus can insert event house payments"
  ON public.event_house_payments FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admin and pengurus can update event house payments"
  ON public.event_house_payments FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE POLICY "Admin and pengurus can delete event house payments"
  ON public.event_house_payments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pengurus'::app_role));

CREATE TRIGGER update_event_house_payments_updated_at
  BEFORE UPDATE ON public.event_house_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function
CREATE OR REPLACE FUNCTION public.has_paid_for_event(_house_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_house_payments
    WHERE house_id = _house_id AND event_id = _event_id
  );
$$;
