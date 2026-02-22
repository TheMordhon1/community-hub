-- Create schedules table for custom calendar activities
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date DATE NOT NULL,
  start_time TEXT,
  end_date DATE,
  color TEXT DEFAULT '#6366f1',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read schedules
CREATE POLICY "Authenticated users can view schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert their own schedules
CREATE POLICY "Authenticated users can insert schedules"
  ON public.schedules FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Users can update their own schedules; pengurus/admin can update any
CREATE POLICY "Users can update own schedules or admin can update any"
  ON public.schedules FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'pengurus')
    )
  );

-- Users can delete their own schedules; pengurus/admin can delete any
CREATE POLICY "Users can delete own schedules or admin can delete any"
  ON public.schedules FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'pengurus')
    )
  );

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION update_schedules_updated_at();
