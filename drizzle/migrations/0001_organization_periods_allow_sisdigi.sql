CREATE OR REPLACE FUNCTION public.can_manage_organization(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role) OR public.is_menteri_sisdigi(_user_id)
$$;

DROP POLICY "Admins can insert periods" ON public.organization_periods;
DROP POLICY "Admins can update periods" ON public.organization_periods;
DROP POLICY "Admins can delete inactive periods" ON public.organization_periods;
DROP POLICY "Admins can insert period members" ON public.organization_period_members;
DROP POLICY "Admins can update period members" ON public.organization_period_members;
DROP POLICY "Admins can delete period members" ON public.organization_period_members;

CREATE POLICY "Org managers can insert periods" ON public.organization_periods
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_organization(auth.uid()));
CREATE POLICY "Org managers can update periods" ON public.organization_periods
  FOR UPDATE TO authenticated USING (public.can_manage_organization(auth.uid()));
CREATE POLICY "Org managers can delete inactive periods" ON public.organization_periods
  FOR DELETE TO authenticated USING (public.can_manage_organization(auth.uid()) AND is_active = false);
CREATE POLICY "Org managers can insert period members" ON public.organization_period_members
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_organization(auth.uid()));
CREATE POLICY "Org managers can update period members" ON public.organization_period_members
  FOR UPDATE TO authenticated USING (public.can_manage_organization(auth.uid()));
CREATE POLICY "Org managers can delete period members" ON public.organization_period_members
  FOR DELETE TO authenticated USING (public.can_manage_organization(auth.uid()));

CREATE OR REPLACE FUNCTION public.activate_organization_period(_period_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_organization(auth.uid()) THEN
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