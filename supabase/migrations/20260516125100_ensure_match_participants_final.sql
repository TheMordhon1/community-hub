-- Clean up duplicates and ensure unique constraint
DO $$ 
BEGIN 
    -- 1. Remove duplicates before adding constraint
    DELETE FROM competition_match_participants a
    USING competition_match_participants b
    WHERE a.id > b.id 
    AND a.match_id = b.match_id 
    AND a.team_id = b.team_id;

    -- 2. Ensure winner_rank column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competition_match_participants' AND column_name = 'winner_rank') THEN
        ALTER TABLE competition_match_participants ADD COLUMN winner_rank INTEGER;
    END IF;

    -- 3. Add unique constraint if missing
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competition_match_participants_match_id_team_id_key') THEN
        ALTER TABLE competition_match_participants ADD CONSTRAINT competition_match_participants_match_id_team_id_key UNIQUE (match_id, team_id);
    END IF;
END $$;

-- Ensure RLS is correct for upsert (requires both USING and WITH CHECK)
DROP POLICY IF EXISTS "Admin/Pengurus can manage match participants" ON competition_match_participants;
CREATE POLICY "Admin/Pengurus can manage match participants"
  ON competition_match_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'pengurus')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'pengurus')
    )
  );
