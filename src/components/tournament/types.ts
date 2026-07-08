export interface Team {
  id: string;
  name: string;
  logo?: string;
}

export interface Match {
  id: string;
  round: number;
  date: string;
  time?: string;
  status: "upcoming" | "live" | "finished";
  team1?: Team;
  team2?: Team;
  score1?: number;
  score2?: number;
  winnerId?: string;
  nextMatchId?: string;
}

export interface Round {
  id: number;
  title: string;
  matches: Match[];
}
