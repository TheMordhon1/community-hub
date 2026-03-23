
-- Add missing UPDATE policy for announcement_reads to support upsert operations
CREATE POLICY "Users can update own read"
  ON public.announcement_reads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
