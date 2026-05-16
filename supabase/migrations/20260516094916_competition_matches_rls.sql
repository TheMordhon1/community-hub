-- Enable RLS on competition_matches if not already enabled
ALTER TABLE public.competition_matches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view competition_matches" ON public.competition_matches;
DROP POLICY IF EXISTS "Admins, Pengurus and Referees can insert matches" ON public.competition_matches;
DROP POLICY IF EXISTS "Admins, Pengurus and Referees can update matches" ON public.competition_matches;
DROP POLICY IF EXISTS "Admins, Pengurus and Referees can delete matches" ON public.competition_matches;

-- Select Policy: everyone authenticated can view
CREATE POLICY "Anyone can view competition_matches"
ON public.competition_matches
FOR SELECT
TO authenticated
USING (true);

-- Insert Policy: Admin, Pengurus, or assigned Referee
CREATE POLICY "Admins, Pengurus and Referees can insert matches"
ON public.competition_matches
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.competition_referees
    WHERE competition_referees.competition_id = competition_matches.competition_id
    AND competition_referees.user_id = auth.uid()
  )
);

-- Update Policy: Admin, Pengurus, or assigned Referee
CREATE POLICY "Admins, Pengurus and Referees can update matches"
ON public.competition_matches
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.competition_referees
    WHERE competition_referees.competition_id = competition_matches.competition_id
    AND competition_referees.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.competition_referees
    WHERE competition_referees.competition_id = competition_matches.competition_id
    AND competition_referees.user_id = auth.uid()
  )
);

-- Delete Policy: Admin, Pengurus, or assigned Referee
CREATE POLICY "Admins, Pengurus and Referees can delete matches"
ON public.competition_matches
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'pengurus'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.competition_referees
    WHERE competition_referees.competition_id = competition_matches.competition_id
    AND competition_referees.user_id = auth.uid()
  )
);
