
ALTER TABLE public.competition_teams
  ALTER COLUMN age TYPE numeric(4,1) USING age::numeric;
