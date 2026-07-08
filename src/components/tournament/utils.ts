import { Match, Round } from "./types";

export function getRoundName(roundNum: number, totalRounds: number): string {
  if (roundNum === totalRounds && totalRounds > 1) return "Final";
  if (roundNum === totalRounds - 1 && totalRounds > 2) return "Semifinal";
  if (roundNum === totalRounds - 2 && totalRounds > 3) return "Perempat Final";
  return `Babak ${roundNum}`;
}

export function groupMatchesIntoRounds(matches: Match[]): Round[] {
  const grouped: Record<number, Match[]> = {};
  matches.forEach((m) => {
    const r = m.round;
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(m);
  });

  const rounds: Round[] = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b)
    .map((rNum) => {
      return {
        id: rNum,
        title: "",
        matches: grouped[rNum],
      };
    });

  const total = rounds.length;
  rounds.forEach((r) => {
    r.title = getRoundName(r.id, total);
  });

  return rounds;
}
