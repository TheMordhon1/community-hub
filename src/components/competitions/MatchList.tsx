import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Trophy, Calendar, MapPin, Edit } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { EventCompetitionWithDetails, CompetitionMatchWithTeams } from "@/types/competition";
import { MATCH_STATUS_LABELS } from "@/types/competition";
import { UpdateMatchDialog } from "@/components/competitions/UpdateMatchDialog";

interface MatchListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
}

export function MatchList({ competition, canManage }: MatchListProps) {
  const [editingMatch, setEditingMatch] = useState<CompetitionMatchWithTeams | null>(null);
  
  const matches = competition.matches || [];

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Swords className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
          <p className="text-muted-foreground">Belum ada pertandingan</p>
          {competition.format === "knockout" && competition.teams && competition.teams.length >= 2 && (
            <p className="text-sm text-muted-foreground mt-2">
              Klik "Generate Bracket" untuk membuat jadwal pertandingan
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    const round = match.round_number;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, CompetitionMatchWithTeams[]>);

  const getRoundName = (round: number, totalRounds: number) => {
    const fromEnd = totalRounds - round + 1;
    if (fromEnd === 1) return "Final";
    if (fromEnd === 2) return "Semi Final";
    if (fromEnd === 3) return "Perempat Final";
    return `Babak ${round}`;
  };

  const totalRounds = Math.max(...Object.keys(matchesByRound).map(Number));

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "scheduled":
        return "outline";
      case "ongoing":
        return "secondary";
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(matchesByRound)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([round, roundMatches]) => (
          <div key={round} className="space-y-3">
            <h4 className="font-semibold text-lg flex items-center gap-2">
              {getRoundName(Number(round), totalRounds)}
              <Badge variant="outline">{roundMatches.length} pertandingan</Badge>
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              {roundMatches.map((match) => (
                <Card key={match.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Match Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                      <span className="text-xs text-muted-foreground">
                        Match {match.match_number}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(match.status)} className="text-xs">
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingMatch(match)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Teams */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {/* Team 1 */}
                        <div className={`flex items-center justify-between ${match.winner_id === match.team1_id ? 'font-bold' : ''}`}>
                          <div className="flex items-center gap-2">
                            {match.winner_id === match.team1_id && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className={!match.team1 ? 'text-muted-foreground italic' : ''}>
                              {match.team1?.name || "TBD"}
                            </span>
                          </div>
                          <span className="text-lg font-mono">
                            {match.score1 || "-"}
                          </span>
                        </div>

                        <div className="border-t" />

                        {/* Team 2 */}
                        <div className={`flex items-center justify-between ${match.winner_id === match.team2_id ? 'font-bold' : ''}`}>
                          <div className="flex items-center gap-2">
                            {match.winner_id === match.team2_id && (
                              <Trophy className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className={!match.team2 ? 'text-muted-foreground italic' : ''}>
                              {match.team2?.name || "TBD"}
                            </span>
                          </div>
                          <span className="text-lg font-mono">
                            {match.score2 || "-"}
                          </span>
                        </div>
                      </div>

                      {/* Match Details */}
                      {(match.match_datetime || match.location) && (
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                          {match.match_datetime && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(match.match_datetime), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                            </div>
                          )}
                          {match.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.location}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

      {/* Update Match Dialog */}
      <UpdateMatchDialog
        open={!!editingMatch}
        onOpenChange={(open) => !open && setEditingMatch(null)}
        match={editingMatch}
        competition={competition}
      />
    </div>
  );
}
