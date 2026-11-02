ALTER TABLE public.organization_periods ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.organization_periods ADD COLUMN IF NOT EXISTS end_date date;

UPDATE public.organization_periods
SET start_date = COALESCE(start_date, make_date(start_year, 1, 1)),
    end_date = COALESCE(end_date, make_date(COALESCE(end_year, start_year), 12, 31));

ALTER TABLE public.organization_periods
  ADD CONSTRAINT organization_periods_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);