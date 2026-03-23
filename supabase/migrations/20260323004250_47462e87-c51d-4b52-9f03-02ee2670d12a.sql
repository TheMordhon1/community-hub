
CREATE TABLE public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reads"
  ON public.announcement_reads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own read"
  ON public.announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
