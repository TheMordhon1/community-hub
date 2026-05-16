-- Add many-to-many relationship for match participants
CREATE TABLE competition_match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES competition_matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES competition_teams(id) ON DELETE CASCADE,
  score VARCHAR(50),
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, team_id)
);

-- Enable RLS
ALTER TABLE competition_match_participants ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access for match participants"
  ON competition_match_participants FOR SELECT
  USING (true);

CREATE POLICY "Admin/Pengurus can manage match participants"
  ON competition_match_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'pengurus')
    )
  );
