CREATE TABLE public.organization_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_year integer NOT NULL,
  end_year integer,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organization_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_periods TO authenticated;
GRANT ALL ON public.organization_periods TO service_role;
ALTER TABLE public.organization_periods ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX organization_periods_single_active ON public.organization_periods ((is_active)) WHERE is_active = true;

CREATE POLICY "Authenticated can view periods" ON public.organization_periods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert periods" ON public.organization_periods
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update periods" ON public.organization_periods
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete inactive periods" ON public.organization_periods
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) AND is_active = false);

CREATE TRIGGER update_organization_periods_updated_at
  BEFORE UPDATE ON public.organization_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.organization_period_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.organization_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.pengurus_titles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_period_members TO authenticated;
GRANT ALL ON public.organization_period_members TO service_role;
ALTER TABLE public.organization_period_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view period members" ON public.organization_period_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert period members" ON public.organization_period_members
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update period members" ON public.organization_period_members
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete period members" ON public.organization_period_members
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_organization_period_members_updated_at
  BEFORE UPDATE ON public.organization_period_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sync user_roles so only members of the active period hold pengurus access/titles
CREATE OR REPLACE FUNCTION public.sync_active_organization_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _active uuid;
BEGIN
  SELECT id INTO _active FROM public.organization_periods WHERE is_active = true LIMIT 1;

  -- Revoke pengurus / titles from anyone not in the active period
  UPDATE public.user_roles ur
  SET role = CASE WHEN ur.role = 'admin'::app_role THEN 'admin'::app_role ELSE 'warga'::app_role END,
      title_id = NULL
  WHERE (ur.role = 'pengurus'::app_role OR ur.title_id IS NOT NULL)
    AND (_active IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.organization_period_members m
      WHERE m.period_id = _active AND m.user_id = ur.user_id
    ));

  IF _active IS NULL THEN
    RETURN;
  END IF;

  -- Grant pengurus + title to active period members (admins keep admin role)
  UPDATE public.user_roles ur
  SET role = CASE WHEN ur.role = 'admin'::app_role THEN 'admin'::app_role ELSE 'pengurus'::app_role END,
      title_id = m.title_id
  FROM public.organization_period_members m
  WHERE m.period_id = _active
    AND m.user_id = ur.user_id
    AND (ur.title_id IS DISTINCT FROM m.title_id
         OR (ur.role <> 'admin'::app_role AND ur.role <> 'pengurus'::app_role));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_active_organization_roles() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_organization_period(_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Hanya admin yang dapat mengaktifkan periode';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_periods WHERE id = _period_id) THEN
    RAISE EXCEPTION 'Periode tidak ditemukan';
  END IF;

  UPDATE public.organization_periods SET is_active = false WHERE is_active = true AND id <> _period_id;
  UPDATE public.organization_periods SET is_active = true WHERE id = _period_id;
  PERFORM public.sync_active_organization_roles();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_organization_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_organization_period(uuid) TO authenticated;

-- Re-sync roles whenever members of the active period change
CREATE OR REPLACE FUNCTION public.handle_period_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid := COALESCE(NEW.period_id, OLD.period_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.organization_periods WHERE id = _pid AND is_active = true)
     OR (TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.organization_periods WHERE id = OLD.period_id AND is_active = true)) THEN
    PERFORM public.sync_active_organization_roles();
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_period_member_change
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_period_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_period_member_change();

-- Backfill: current structure becomes the active 2026 period
DO $$
DECLARE
  _pid uuid;
BEGIN
  INSERT INTO public.organization_periods (name, start_year, end_year, is_active)
  VALUES ('Periode 2026', 2026, 2026, true)
  RETURNING id INTO _pid;

  INSERT INTO public.organization_period_members (period_id, user_id, title_id)
  SELECT _pid, ur.user_id, ur.title_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.title_id IS NOT NULL
  ON CONFLICT (period_id, user_id) DO NOTHING;
END $$;