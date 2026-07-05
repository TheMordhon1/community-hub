// Liga Grup + Gugur helpers: standings, group schedule, knockout seeding.
import type {
  CompetitionTeamWithMembers,
  CompetitionMatchWithTeams,
} from "@/types/competition";

export const GROUP_LETTERS = "ABCDEFGHIJKLMN".split("");

export interface StandingRow {
  team: CompetitionTeamWithMembers;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number; // sum of sets won
  setsFor: number;
  setsAgainst: number;
  diff: number;
}

/**
 * Compute standings for a group.
 * For each completed group-stage match, score1/score2 represent the number of
 * sets won by team1/team2 respectively. Each set won = 1 poin.
 */
export function computeStandings(
  teams: CompetitionTeamWithMembers[],
  matches: CompetitionMatchWithTeams[],
  groupName: string
): StandingRow[] {
  const groupTeams = teams.filter((t) => t.group_name === groupName);
  const rows = new Map<string, StandingRow>();
  for (const t of groupTeams) {
    rows.set(t.id, {
      team: t,
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      setsFor: 0,
      setsAgainst: 0,
      diff: 0,
    });
  }

  for (const m of matches) {
    if (m.stage !== "group") continue;
    if (m.group_name !== groupName) continue;
    if (m.status !== "completed") continue;
    if (!m.team1_id || !m.team2_id) continue;
    const r1 = rows.get(m.team1_id);
    const r2 = rows.get(m.team2_id);
    if (!r1 || !r2) continue;

    const s1 = parseInt(m.score1 ?? "0", 10) || 0;
    const s2 = parseInt(m.score2 ?? "0", 10) || 0;
    r1.played += 1;
    r2.played += 1;
    r1.setsFor += s1;
    r1.setsAgainst += s2;
    r2.setsFor += s2;
    r2.setsAgainst += s1;
    if (s1 > s2) {
      r1.wins += 1;
      r2.losses += 1;
      r1.points += 2;
    } else if (s2 > s1) {
      r2.wins += 1;
      r1.losses += 1;
      r2.points += 2;
    } else {
      r1.draws += 1;
      r2.draws += 1;
      r1.points += 1;
      r2.points += 1;
    }
    r1.diff = r1.setsFor - r1.setsAgainst;
    r2.diff = r2.setsFor - r2.setsAgainst;
  }


  return Array.from(rows.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    // Head-to-Head tiebreaker
    const h2hMatch = matches.find(m => 
      m.stage === "group" && m.group_name === groupName && m.status === "completed" &&
      ((m.team1_id === a.team.id && m.team2_id === b.team.id) || (m.team1_id === b.team.id && m.team2_id === a.team.id))
    );
    
    if (h2hMatch) {
      if (h2hMatch.winner_id === a.team.id) return -1;
      if (h2hMatch.winner_id === b.team.id) return 1;
      
      const s1 = parseInt(h2hMatch.score1 ?? "0", 10) || 0;
      const s2 = parseInt(h2hMatch.score2 ?? "0", 10) || 0;
      if (h2hMatch.team1_id === a.team.id) {
        if (s1 > s2) return -1;
        if (s2 > s1) return 1;
      } else {
        if (s2 > s1) return -1;
        if (s1 > s2) return 1;
      }
    }

    if (b.diff !== a.diff) return b.diff - a.diff;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.team.name.localeCompare(b.team.name);
  });
}

/**
 * Round-robin pairings for a single group (each pair plays once).
 */
export function roundRobinPairs<T>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

/**
 * Auto-distribute teams into N groups by simple round-robin allocation.
 */
export function distributeTeamsToGroups(
  teamIds: string[],
  groupCount: number
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (let g = 0; g < groupCount; g++) result[GROUP_LETTERS[g]] = [];
  const shuffled = [...teamIds].sort(() => Math.random() - 0.5);
  shuffled.forEach((id, idx) => {
    const letter = GROUP_LETTERS[idx % groupCount];
    result[letter].push(id);
  });
  return result;
}

/**
 * Seed the knockout stage from group standings. Uses cross-group pairing:
 * A1 vs (last group)2, B1 vs (last-1)2, etc. — the classic
 * "juara grup vs runner-up grup lain" scheme.
 */
export function seedKnockoutFromStandings(
  standingsByGroup: Record<string, StandingRow[]>,
  advancePerGroup: number
): { team1_id: string; team2_id: string; label: string }[] {
  const groupNames = Object.keys(standingsByGroup).sort();
  const qualifiers: { teamId: string; group: string; rank: number }[] = [];
  for (const g of groupNames) {
    const s = standingsByGroup[g];
    for (let r = 0; r < Math.min(advancePerGroup, s.length); r++) {
      qualifiers.push({ teamId: s[r].team.id, group: g, rank: r + 1 });
    }
  }

  // Split winners (rank 1) vs runners-up (rank 2)
  const winners = qualifiers.filter((q) => q.rank === 1);
  const runners = qualifiers.filter((q) => q.rank === 2);

  // Pair each winner with a runner from a different group; rotate.
  const pairs: { team1_id: string; team2_id: string; label: string }[] = [];
  const used = new Set<number>();
  winners.forEach((w, i) => {
    // Find a runner from a different group not yet used.
    let idx = runners.findIndex(
      (r, ri) => !used.has(ri) && r.group !== w.group
    );
    if (idx === -1) {
      idx = runners.findIndex((_, ri) => !used.has(ri));
    }
    if (idx === -1) return;
    used.add(idx);
    const r = runners[idx];
    pairs.push({
      team1_id: w.teamId,
      team2_id: r.teamId,
      label: `Juara Grup ${w.group} vs Runner-up Grup ${r.group}`,
    });
  });

  // Any remaining qualifiers (e.g. odd count, more than 2 advance) get paired sequentially.
  const remaining = qualifiers.filter(
    (q) =>
      !winners.includes(q) &&
      !runners.filter((_, ri) => used.has(ri)).includes(q)
  );
  for (let i = 0; i + 1 < remaining.length; i += 2) {
    pairs.push({
      team1_id: remaining[i].teamId,
      team2_id: remaining[i + 1].teamId,
      label: `Grup ${remaining[i].group} vs Grup ${remaining[i + 1].group}`,
    });
  }

  return pairs;
}

export function areAllGroupMatchesCompleted(
  matches: CompetitionMatchWithTeams[]
): boolean {
  const groupMatches = matches.filter((m) => m.stage === "group");
  if (groupMatches.length === 0) return false;
  return groupMatches.every((m) => m.status === "completed");
}

export function hasKnockoutMatches(matches: CompetitionMatchWithTeams[]): boolean {
  return matches.some((m) => m.stage === "knockout");
}

export function hasGroupMatches(matches: CompetitionMatchWithTeams[]): boolean {
  return matches.some((m) => m.stage === "group");
}
