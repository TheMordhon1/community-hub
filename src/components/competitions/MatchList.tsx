import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Trophy, Calendar, MapPin, Edit, RefreshCw, Trash2, MoreVertical, Medal, Eye, CheckCircle2, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { EventCompetitionWithDetails, CompetitionMatchWithTeams } from "@/types/competition";
import { MATCH_STATUS_LABELS } from "@/types/competition";
import { UpdateMatchDialog } from "@/components/competitions/UpdateMatchDialog";
import { LiveScoreDialog } from "@/components/competitions/LiveScoreDialog";
import { SpinWheelDialog } from "@/components/competitions/SpinWheelDialog";
import { Play } from "lucide-react";
import { useResetMatch, useDeleteMatch, useUpdateMatch, useAssignMatchTeams } from "@/hooks/useCompetitions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MatchListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
}

export function MatchList({ competition, canManage }: MatchListProps) {
  const [editingMatch, setEditingMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [liveScoringMatch, setLiveScoringMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [viewingMatch, setViewingMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [spinningMatch, setSpinningMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [matchToReset, setMatchToReset] = useState<string | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);

  const resetMatch = useResetMatch();
  const deleteMatch = useDeleteMatch();
  const updateMutation = useUpdateMatch();
  const assignTeams = useAssignMatchTeams();
  const matches = competition.matches || [];
  const allTeams = competition.teams || [];
  const is17an = competition.format === "17an";

  const handleResetMatch = () => {
    if (matchToReset) {
      resetMatch.mutate({ id: matchToReset, competition_id: competition.id }, {
        onSuccess: () => setMatchToReset(null)
      });
    }
  };

  const handleDeleteMatch = () => {
    if (matchToDelete) {
      deleteMatch.mutate({ id: matchToDelete, competition_id: competition.id }, {
        onSuccess: () => setMatchToDelete(null)
      });
    }
  };

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

  // Sort matches within each round by datetime (nulls last), then by match_number
  const timeOf = (m: CompetitionMatchWithTeams) =>
    m.match_datetime ? new Date(m.match_datetime).getTime() : Number.POSITIVE_INFINITY;

  Object.keys(matchesByRound).forEach((r) => {
    matchesByRound[Number(r)].sort((a, b) => {
      const diff = timeOf(a) - timeOf(b);
      if (diff !== 0) return diff;
      return (a.match_number || 0) - (b.match_number || 0);
    });
  });

  const getRoundName = (round: number, totalRounds: number, matches: CompetitionMatchWithTeams[]) => {
    // Check if there's a custom phase label in any match of this round
    const customLabel = matches.find(m => m.phase_label)?.phase_label;
    if (customLabel) return customLabel;

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

  // Order phases by earliest match datetime, then by round number
  const sortedRoundEntries = Object.entries(matchesByRound).sort(([ra, ma], [rb, mb]) => {
    const ta = Math.min(...ma.map(timeOf));
    const tb = Math.min(...mb.map(timeOf));
    if (ta !== tb) return ta - tb;
    return Number(ra) - Number(rb);
  });

  return (
    <div className="space-y-6">
      {sortedRoundEntries
        .map(([round, roundMatches]) => (
          <div key={round} className="space-y-3">
            <h4 className="font-semibold text-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {getRoundName(Number(round), totalRounds, roundMatches)}
                <Badge variant="outline" className="font-normal text-xs">{roundMatches.length} pertandingan</Badge>
              </div>
              {canManage && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    const firstMatch = roundMatches[0];
                    const newLabel = window.prompt("Ubah Nama Babak/Fase:", firstMatch.phase_label || "");
                    if (newLabel !== null) {
                      // Bulk update all matches in this round
                      roundMatches.forEach(m => {
                        updateMutation.mutate({
                          id: m.id,
                          competition_id: competition.id,
                          phase_label: newLabel || null
                        });
                      });
                    }
                  }}
                >
                  <Edit className="w-3 h-3" />
                  Ubah Nama
                </Button>
              )}
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              {roundMatches.map((match) => (
                <Card key={match.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Match Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Match {match.match_number}
                        </span>
                        {match.is_final && (
                          <Trophy className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(match.status)} className={`text-xs ${match.status === 'ongoing' ? 'pl-5 relative' : ''}`}>
                          {match.status === 'ongoing' && (
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                            </span>
                          )}
                          {MATCH_STATUS_LABELS[match.status]}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {match.status === "ongoing" && canManage && (
                            <Button
                              size="sm"
                              className="h-7 text-[10px] sm:text-xs px-2 sm:px-3 bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 font-bold"
                              onClick={() => setLiveScoringMatch(match)}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              <span className="hidden xs:inline">Live Score</span>
                              <span className="xs:hidden">Score</span>
                            </Button>
                          )}

                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-7 text-[10px] sm:text-xs px-2 sm:px-3 gap-1"
                            onClick={() => setViewingMatch(match)}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Detail</span>
                          </Button>
                          
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted">
                                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setEditingMatch(match)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Pertandingan
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setSpinningMatch(match)}
                                  disabled={match.status === "completed" || allTeams.length === 0}
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Spin Wheel Peserta
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setMatchToReset(match.id)}
                                  className="text-amber-600 focus:text-amber-600 focus:bg-amber-50"
                                >
                                  <RefreshCw className={`w-4 h-4 mr-2 ${resetMatch.isPending ? 'animate-spin' : ''}`} />
                                  Reset Skor
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setMatchToDelete(match.id)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/5"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Hapus Pertandingan
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Teams */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {match.participants && match.participants.length > 0 ? (
                          match.participants.map((p, idx) => (
                            <div key={p.id}>
                              {idx > 0 && <div className="border-t my-3" />}
                              <div className={`flex items-center justify-between ${p.is_winner ? 'font-bold text-primary' : ''}`}>
                                <div className="flex items-center gap-2">
                                  {match.is_point !== false && (
                                    <>
                                      {(p.is_winner && !p.winner_rank) && (
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                      )}
                                      {p.winner_rank === 1 && (
                                        <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                      )}
                                      {p.winner_rank === 2 && (
                                        <Trophy className="w-4 h-4 text-slate-400 fill-slate-400" />
                                      )}
                                      {p.winner_rank === 3 && (
                                        <Trophy className="w-4 h-4 text-amber-600 fill-amber-600" />
                                      )}
                                    </>
                                  )}
                                  <span className="text-sm">
                                    {p.team?.name || "TBD"}
                                  </span>
                                </div>
                                <span className="text-base font-mono">
                                  {match.is_point !== false ? (
                                    p.score || "-"
                                  ) : (
                                    p.is_winner && (
                                      p.winner_rank === 1 ? <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> :
                                      p.winner_rank === 2 ? <Trophy className="w-5 h-5 text-slate-400 fill-slate-400" /> :
                                      p.winner_rank === 3 ? <Trophy className="w-5 h-5 text-amber-600 fill-amber-600" /> :
                                      <CheckCircle2 className="w-5 h-5 text-primary" />
                                    )
                                  )}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <>
                            {/* Team 1 */}
                            <div className={`flex items-center justify-between ${match.winner_id === match.team1_id ? 'font-bold text-primary' : ''}`}>
                              <div className="flex items-center gap-2">
                                {match.is_point !== false && (
                                  <>
                                    {match.winner_id === match.team1_id && !match.participants?.some(p => p.team_id === match.team1_id && p.winner_rank) && (
                                      <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank === 1 && (
                                      <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank === 2 && (
                                      <Trophy className="w-4 h-4 text-slate-400 fill-slate-400" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank === 3 && (
                                      <Trophy className="w-4 h-4 text-amber-600 fill-amber-600" />
                                    )}
                                  </>
                                )}
                                <span className={`text-sm ${!match.team1 ? 'text-muted-foreground italic' : ''}`}>
                                  {match.team1?.name || "TBD"}
                                </span>
                              </div>
                              <span className="text-base font-mono">
                                {match.is_point !== false ? (
                                  match.score1 || "-"
                                ) : (
                                  (match.winner_id === match.team1_id || match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank === 1) && (
                                    <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                  )
                                )}
                              </span>
                            </div>

                            <div className="border-t" />

                            {/* Team 2 */}
                            <div className={`flex items-center justify-between ${match.winner_id === match.team2_id ? 'font-bold text-primary' : ''}`}>
                              <div className="flex items-center gap-2">
                                {match.is_point !== false && (
                                  <>
                                    {match.winner_id === match.team2_id && !match.participants?.some(p => p.team_id === match.team2_id && p.winner_rank) && (
                                      <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank === 1 && (
                                      <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank === 2 && (
                                      <Trophy className="w-4 h-4 text-slate-400 fill-slate-400" />
                                    )}
                                    {match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank === 3 && (
                                      <Trophy className="w-4 h-4 text-amber-600 fill-amber-600" />
                                    )}
                                  </>
                                )}
                                <span className={`text-sm ${!match.team2 ? 'text-muted-foreground italic' : ''}`}>
                                  {match.team2?.name || "TBD"}
                                </span>
                              </div>
                              <span className="text-base font-mono">
                                {match.is_point !== false ? (
                                  match.score2 || "-"
                                ) : (
                                  (match.winner_id === match.team2_id || match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank === 1) && (
                                    <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                  )
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Per-set breakdown */}
                      {Array.isArray(match.sets_data) && match.sets_data.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-1.5">
                            {match.sets_data.map((s, i) => {
                              const t1w = Number(s.team1_score) > Number(s.team2_score);
                              const t2w = Number(s.team2_score) > Number(s.team1_score);
                              return (
                                <Badge key={i} variant="outline" className="text-[10px] font-mono">
                                  Set {i + 1}:{" "}
                                  <span className={t1w ? "font-bold text-primary ml-1" : "ml-1"}>{s.team1_score}</span>
                                  <span className="mx-0.5 text-muted-foreground">-</span>
                                  <span className={t2w ? "font-bold text-primary" : ""}>{s.team2_score}</span>
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}


                      {/* Match Details */}
                      {(match.match_datetime || match.location || match.age_bracket_label || match.age_bracket_min != null || match.age_bracket_max != null) && (
                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                          {(match.age_bracket_label || match.age_bracket_min != null || match.age_bracket_max != null) && (
                            <Badge variant="secondary" className="text-[10px]">
                              Umur:{" "}
                              {match.age_bracket_label
                                ? match.age_bracket_label
                                : `${match.age_bracket_min ?? "?"} - ${match.age_bracket_max ?? "?"} thn`}
                            </Badge>
                          )}
                          {match.match_datetime && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(match.match_datetime), "dd MMM yyyy, HH:mm", { locale: idLocale })}
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

      {/* Live Score Dialog */}
      <LiveScoreDialog
        open={!!liveScoringMatch}
        onOpenChange={(open) => !open && setLiveScoringMatch(null)}
        match={liveScoringMatch}
        competition={competition}
      />

      <LiveScoreDialog 
        open={!!viewingMatch} 
        onOpenChange={(open) => !open && setViewingMatch(null)}
        match={viewingMatch}
        competition={competition}
        readOnly={true}
      />

      {/* Spin Wheel per-match */}
      {spinningMatch && (() => {
        const currentIds = new Set<string>([
          ...(spinningMatch.participants?.map((p) => p.team_id) || []),
          ...(spinningMatch.team1_id ? [spinningMatch.team1_id] : []),
          ...(spinningMatch.team2_id ? [spinningMatch.team2_id] : []),
        ]);
        const pool = allTeams.filter((t) => !currentIds.has(t.id));
        const currentCount =
          spinningMatch.participants?.length ||
          (spinningMatch.team1_id ? 1 : 0) + (spinningMatch.team2_id ? 1 : 0);
        const limit = spinningMatch.max_participants ?? (is17an ? Math.max(2, currentCount || 2) : 2);
        const defaultTarget = Math.max(1, limit - currentCount);
        return (
          <SpinWheelDialog
            open={!!spinningMatch}
            onOpenChange={(open) => !open && setSpinningMatch(null)}
            teams={pool}
            targetCount={defaultTarget}
            allowTargetEdit={is17an && spinningMatch.max_participants == null}
            applying={assignTeams.isPending}
            title={`Spin Wheel — Match ${spinningMatch.match_number}`}
            description="Putar untuk memilih peserta pertandingan ini secara acak. Sistem berhenti otomatis saat jumlah peserta tercapai."
            onApply={(picked) => {
              const existing = spinningMatch.participants?.map((p) => p.team_id) || [];
              const merged = Array.from(new Set([...existing, ...picked]));
              assignTeams.mutate(
                {
                  match_id: spinningMatch.id,
                  competition_id: competition.id,
                  team_ids: merged,
                  use_team_slots: !is17an && limit <= 2,
                },
                { onSuccess: () => setSpinningMatch(null) },
              );
            }}
          />
        );
      })()}

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!matchToReset} onOpenChange={(open) => !open && setMatchToReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Pertandingan?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh skor dan data pemenang untuk pertandingan ini akan dihapus. 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetMatch}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={resetMatch.isPending}
            >
              {resetMatch.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Ya, Reset Skor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!matchToDelete} onOpenChange={(open) => !open && setMatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pertandingan?</AlertDialogTitle>
            <AlertDialogDescription>
              Pertandingan ini akan dihapus secara permanen dari sistem. 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMatch.isPending}
            >
              {deleteMatch.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
