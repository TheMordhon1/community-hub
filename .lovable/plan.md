## Liga Grup + Gugur

New competition format that combines a group-stage round-robin with a knockout stage.

### Flow

1. Admin creates competition with format **"Liga Grup + Gugur"** and chooses the **number of groups** (Grup A, B, C, …).
2. Admin assigns each registered team to a group.
3. Admin clicks **"Generate Jadwal Grup"** → system auto-creates round-robin matches inside each group (each match = 2 sets).
4. Referees/admin record who wins each set. Set winner gets **1 poin**. Match winner = more set poin.
5. Standings table auto-computes poin, menang/kalah, selisih set per group. Live.
6. When all group matches complete, admin clicks **"Generate Babak Gugur"** → top 2 of each group seed into a knockout bracket.
7. Knockout runs to Final + match for 3rd place → Juara 1, 2, 3.

### Database

- `event_competitions`: add `group_count` (int), `sets_per_match` (int, default 2), `advance_per_group` (int, default 2).
- `competition_teams`: add `group_name` text (nullable) — "A", "B", "C" …
- `competition_matches`: already has `group_name`. Add `stage` text ('group' | 'knockout') and `sets_data` jsonb — array like `[{team1_score, team2_score, winner_team_id}, {...}]`.

### UI

- **CreateCompetitionDialog**: new format option "Liga Grup + Gugur". When selected, show inputs for group count (default 3), sets per match (default 2), advance per group (default 2).
- **TeamList**: when format is liga_grup, show group selector on each team. "Assign otomatis" button distributes teams evenly.
- **Group Standings panel** (new `GroupStandings.tsx`): shows Grup A/B/C tables — Tim, Main, Menang, Kalah, Poin, Selisih. Sorted by poin desc.
- **Match cards**: for group-stage matches, show 2-set score input inline (Set 1: 3-2, Set 2: 1-3). Compute winner + points automatically.
- **Action buttons** on CompetitionDetail:
  - "Generate Jadwal Grup" (visible if all teams have `group_name` and no group matches yet).
  - "Generate Babak Gugur" (visible when every group match `status='completed'`).

### Files

**New:**
- `src/components/competitions/GroupStandings.tsx`
- `src/components/competitions/GroupAssignmentDialog.tsx`
- `src/lib/liga-group.ts` — helpers: `computeStandings(matches, teams)`, `generateGroupSchedule(teams, groups)`, `generateKnockoutFromGroups(standings, advancePerGroup)`.

**Migration:** add columns above.

**Edited:**
- `src/types/competition.ts` — add `'liga_grup'` to `CompetitionFormat`, add new fields.
- `src/hooks/useCompetitions.ts` — pass new fields in create/update mutations, add `useGenerateGroupSchedule` + `useGenerateKnockoutFromGroups` mutations, extend match creation to accept `stage` and `sets_data`.
- `src/components/competitions/CreateCompetitionDialog.tsx` — format option + config inputs.
- `src/components/competitions/TeamList.tsx` — group selector when liga_grup.
- `src/components/competitions/MatchList.tsx` — group-stage matches show set scores + auto compute; separate "Fase Grup" vs "Babak Gugur" sections.
- `src/pages/CompetitionDetail.tsx` — show GroupStandings + generation buttons for liga_grup.

### Notes

- Round-robin schedule: each pair in a group plays once. For 3 teams → 3 matches, 4 teams → 6 matches, etc. `round_number` set to 1 for all group matches; each pairing becomes a separate match_number. `phase_label = "Grup A"`, `stage = 'group'`.
- Knockout: seed as `A1 vs B2`, `B1 vs C2`, `C1 vs A2` (rotating) when 3 groups × top 2. For 2/4 groups: standard 1v2 cross. `stage='knockout'`, `phase_label` set per round (Semi/Final/Perebutan Juara 3).
- Existing 17an, knockout, round_robin formats stay untouched.
