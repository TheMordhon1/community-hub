import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Trophy, Users, CheckCircle2, Medal } from "lucide-react";
import { useUpdateMatch } from "@/hooks/useCompetitions";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface LiveScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: CompetitionMatchWithTeams | null;
  competition: EventCompetitionWithDetails;
  readOnly?: boolean;
}

interface ParticipantScore {
  id: string;
  score: number;
  isWinner: boolean;
  winner_rank: number | null;
}

export function LiveScoreDialog({
  open,
  onOpenChange,
  match,
  competition,
  readOnly = false,
}: LiveScoreDialogProps) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [winnerRank1, setWinnerRank1] = useState<number | null>(null);
  const [winnerRank2, setWinnerRank2] = useState<number | null>(null);
  const [participantScores, setParticipantScores] = useState<ParticipantScore[]>([]);

  const updateMutation = useUpdateMatch();
  const is17an = competition.format === "17an";

  useEffect(() => {
    if (match && open) {
      const cached = localStorage.getItem(`live_score_${match.id}`);
      
      if (match.participants && match.participants.length > 0) {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.participants)) {
              setParticipantScores(parsed.participants);
            } else {
              setParticipantScores(match.participants.map(p => ({
                id: p.id,
                score: parseInt(p.score || "0", 10),
                isWinner: p.is_winner || false,
                winner_rank: p.winner_rank || null
              })));
            }
          } catch {
            setParticipantScores(match.participants.map(p => ({
              id: p.id,
              score: parseInt(p.score || "0", 10),
              isWinner: p.is_winner || false,
              winner_rank: p.winner_rank || null
            })));
          }
        } else {
          setParticipantScores(match.participants.map(p => ({
            id: p.id,
            score: parseInt(p.score || "0", 10),
            isWinner: p.is_winner || false,
            winner_rank: p.winner_rank || null
          })));
        }
      } else {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setScore1(parsed.score1 || 0);
            setScore2(parsed.score2 || 0);
            setWinnerRank1(parsed.winnerRank1 || null);
            setWinnerRank2(parsed.winnerRank2 || null);
          } catch {
            setScore1(parseInt(match.score1 || "0", 10) || 0);
            setScore2(parseInt(match.score2 || "0", 10) || 0);
            setWinnerRank1(match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank || null);
            setWinnerRank2(match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank || null);
          }
        } else {
          setScore1(parseInt(match.score1 || "0", 10) || 0);
          setScore2(parseInt(match.score2 || "0", 10) || 0);
          setWinnerRank1(match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank || null);
          setWinnerRank2(match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank || null);
        }
      }
    }
  }, [match, open]);

  useEffect(() => {
    if (match && open) {
      const data = match.participants && match.participants.length > 0
        ? { participants: participantScores }
        : { score1, score2, winnerRank1, winnerRank2 };
      
      localStorage.setItem(`live_score_${match.id}`, JSON.stringify(data));
    }
  }, [score1, score2, winnerRank1, winnerRank2, participantScores, match, open]);

  const hasParticipants = !!(match?.participants && match.participants.length > 0);

  const handleUpdateProgress = () => {
    if (!match) return;

    const mutationData = {
      id: match.id,
      competition_id: competition.id,
      status: "ongoing" as const,
      participant_scores: hasParticipants 
        ? participantScores.map(ps => ({
            id: ps.id,
            score: ps.score.toString(),
            is_winner: ps.isWinner || (ps.winner_rank === 1),
            winner_rank: ps.winner_rank
          }))
        : (() => {
            const res = [];
            if (match.team1_id) {
              res.push({
                team_id: match.team1_id,
                score: score1.toString(),
                is_winner: winnerRank1 === 1,
                winner_rank: winnerRank1
              });
            }
            if (match.team2_id) {
              res.push({
                team_id: match.team2_id,
                score: score2.toString(),
                is_winner: winnerRank2 === 1,
                winner_rank: winnerRank2
              });
            }
            return res.length > 0 ? res : undefined;
          })(),
      score1: !hasParticipants ? score1.toString() : undefined,
      score2: !hasParticipants ? score2.toString() : undefined,
    };

    updateMutation.mutate(mutationData, {
      onSuccess: () => {
        toast({
          title: "Tersimpan",
          description: "Skor sementara berhasil disimpan.",
        });
      },
    });
  };

  const handleFinishMatch = () => {
    if (!match) return;

    let winnerId: string | null = null;
    if (!hasParticipants) {
      if (score1 > score2) winnerId = match.team1_id;
      else if (score2 > score1) winnerId = match.team2_id;
    }

    const mutationData = {
      id: match.id,
      competition_id: competition.id,
      status: "completed" as const,
      participant_scores: hasParticipants 
        ? participantScores.map(ps => ({
            id: ps.id,
            score: ps.score.toString(),
            is_winner: ps.isWinner,
            winner_rank: ps.winner_rank
          }))
        : (() => {
            const res = [];
            if (match.team1_id) {
              res.push({
                team_id: match.team1_id,
                score: score1.toString(),
                is_winner: winnerRank1 === 1,
                winner_rank: winnerRank1
              });
            }
            if (match.team2_id) {
              res.push({
                team_id: match.team2_id,
                score: score2.toString(),
                is_winner: winnerRank2 === 1,
                winner_rank: winnerRank2
              });
            }
            return res.length > 0 ? res : undefined;
          })(),
      score1: !hasParticipants ? score1.toString() : undefined,
      score2: !hasParticipants ? score2.toString() : undefined,
      winner_id: winnerId,
    };

    updateMutation.mutate(mutationData, {
      onSuccess: () => {
        localStorage.removeItem(`live_score_${match.id}`);
        onOpenChange(false);
        toast({
          title: is17an ? "Sesi Selesai" : "Pertandingan Selesai",
          description: "Hasil akhir berhasil disimpan.",
        });
      },
    });
  };

  const updateParticipantScore = (id: string, delta: number) => {
    setParticipantScores(prev => prev.map(p => 
      p.id === id ? { ...p, score: Math.max(0, p.score + delta) } : p
    ));
  };

  const toggleParticipantWinner = (id: string) => {
    setParticipantScores(prev => prev.map(p => 
      p.id === id ? { ...p, isWinner: !p.isWinner, winner_rank: !p.isWinner ? p.winner_rank : null } : p
    ));
  };

  const setParticipantRank = (id: string, rank: number | null) => {
    setParticipantScores(prev => prev.map(p => 
      p.id === id ? { ...p, rank, isWinner: rank !== null ? true : p.isWinner } : p
    ));
  };

  if (!match) return null;

  const getRankLabel = (rank: number) => {
    switch(rank) {
      case 1: return "Juara 1";
      case 2: return "Juara 2";
      case 3: return "Juara 3";
      default: return `Peringkat ${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch(rank) {
      case 1: return "bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20";
      case 2: return "bg-slate-400 hover:bg-slate-500 shadow-slate-400/20";
      case 3: return "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20";
      default: return "bg-primary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-3xl overflow-auto flex flex-col max-h-[95vh] p-0">
        <DialogHeader className="shrink-0 p-6 pb-2">
          <DialogTitle className="text-center text-xl">
            {readOnly ? "Detail Pertandingan" : (is17an ? "Pencatatan Hasil Sesi" : "Live Score Pertandingan")}
            {match.phase_label && <Badge variant="secondary" className="font-medium ml-2">{match.phase_label}</Badge>}
          </DialogTitle>
          <p className="text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <span>{competition.sport_name}</span>
            <span className="opacity-30">•</span>
            <span>{match.phase_label || (is17an ? `Sesi ${match.match_number}` : `Babak ${match.round_number} (Match ${match.match_number})`)}</span>
            {match.group_name && (
              <>
                <span className="opacity-30">•</span>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider h-5 px-1.5 border-primary/30 text-primary">
                  Grup {match.group_name}
                </Badge>
              </>
            )}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-2">
          {hasParticipants ? (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4 py-2">
                {participantScores.map((ps) => {
                  const participant = match.participants?.find(p => p.id === ps.id);
                  return (
                    <div 
                      key={ps.id} 
                      className={`rounded-2xl p-4 border transition-all duration-300 ${
                        ps.isWinner 
                          ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20' 
                          : 'bg-muted/30 border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        {/* Left: Team Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <Users className={`w-4 h-4 ${ps.isWinner ? 'text-primary' : 'text-muted-foreground'}`} />
                              <h3 className={`font-bold text-base truncate ${ps.isWinner ? 'text-primary' : ''}`}>
                                {participant?.team?.name}
                              </h3>
                              {ps.isWinner && !ps.winner_rank && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 opacity-50" />}
                            </div>

                            {/* Players List */}
                            {(participant?.team as CompetitionTeamWithMembers)?.members && (participant.team as CompetitionTeamWithMembers).members!.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {(participant.team as CompetitionTeamWithMembers).members!.map((m) => (
                                  <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                                    {m.profile?.full_name || "Pemain"}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          {match.is_point !== false && (
                            <div className="flex flex-wrap gap-2">
                              {(ps.isWinner && !ps.winner_rank) && (
                                <Badge variant="default" className="bg-primary text-[10px] h-5 px-1.5 animate-in fade-in zoom-in duration-500">
                                  {match.is_final ? <Trophy className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                  {match.is_final ? "Pemenang" : (is17an ? "Lolos" : "Pemenang")}
                                </Badge>
                              )}
                              {ps.winner_rank && (
                                <Badge className={`${getRankColor(ps.winner_rank)} text-[10px] h-5 px-1.5 shadow-sm animate-in fade-in slide-in-from-left-1 duration-300`}>
                                  <Trophy className="w-3 h-3 mr-1" />
                                  {getRankLabel(ps.winner_rank)}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Right: Score and Trophy */}
                        <div className="flex items-center gap-4">
                          {match.is_point !== false && (
                            <div className="flex flex-col items-center gap-2">
                              {!readOnly ? (
                                <div className="flex items-center gap-2 md:gap-5">
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-10 w-10 md:h-14 md:w-14 rounded-full border-2 hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all active:scale-95"
                                    onClick={() => updateParticipantScore(ps.id, -1)}
                                  >
                                    <Minus className="w-5 h-5 md:w-7 md:h-7" />
                                  </Button>
                                  
                                  <div className="relative group">
                                    <div className="absolute -inset-2 bg-primary/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative w-28 h-20 md:w-40 md:h-24 bg-muted rounded-2xl flex items-center justify-center border-2 border-border shadow-inner overflow-hidden">
                                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
                                      <span className="text-5xl md:text-6xl font-black font-mono tracking-tighter text-foreground drop-shadow-sm">
                                        {ps.score}
                                      </span>
                                    </div>
                                  </div>

                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-10 w-10 md:h-14 md:w-14 rounded-full border-2 hover:bg-primary/10 hover:border-primary hover:text-primary transition-all active:scale-95"
                                    onClick={() => updateParticipantScore(ps.id, 1)}
                                  >
                                    <Plus className="w-5 h-5 md:w-7 md:h-7" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="w-14 h-12 bg-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                                  <span className="text-2xl font-black font-mono text-primary">{ps.score}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {!readOnly && (
                            <Button
                              variant={ps.isWinner ? "default" : "outline"}
                              size="icon"
                              className={`h-12 w-12 md:h-14 md:w-14 rounded-xl transition-all duration-300 ${
                                ps.isWinner ? 'bg-primary shadow-lg shadow-primary/20' : 'hover:border-primary/50'
                              }`}
                              onClick={() => toggleParticipantWinner(ps.id)}
                            >
                              <Trophy className={`w-6 h-6 md:w-8 md:h-8 ${ps.isWinner ? 'fill-current' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </div>

                        {!readOnly && (
                          <div className="flex gap-2 pt-2 border-t border-dashed">
                            {[1, 2, 3].map((r) => (
                              <Button
                                key={r}
                                variant={ps.winner_rank === r ? "default" : "outline"}
                                size="sm"
                                className={`h-8 flex-1 gap-1 text-[10px] uppercase font-bold tracking-tighter transition-all ${
                                  ps.winner_rank === r ? getRankColor(r) : 'text-muted-foreground hover:text-primary hover:border-primary/50'
                                }`}
                                onClick={() => setParticipantRank(ps.id, ps.winner_rank === r ? null : r)}
                              >
                                <Trophy className="w-3 h-3" />
                                Juara {r}
                              </Button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-6 sm:py-10 flex flex-col items-center gap-4">
              <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-8">
                {/* Team 1: Score on the left */}
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <h3 className="font-bold text-xs sm:text-xl text-center line-clamp-1 mb-1">
                    {match.team1?.name || "TBD"}
                  </h3>

                  {/* Players List Team 1 */}
                  {(match.team1 as CompetitionTeamWithMembers)?.members && (match.team1 as CompetitionTeamWithMembers).members!.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-3 max-w-[200px]">
                      {(match.team1 as CompetitionTeamWithMembers).members!.map((m) => (
                        <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                          {m.profile?.full_name || "Pemain"}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted w-24 h-24 sm:w-[180px] sm:h-24 rounded-xl sm:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
                      <span className="text-5xl sm:text-6xl font-black tracking-tighter z-10">{score1}</span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0" onClick={() => setScore1(s => Math.max(0, s - 1))}>
                          <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                        <Button variant="default" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0 shadow-md" onClick={() => setScore1(s => s + 1)}>
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Rank Selection Team 1 */}
                    {!readOnly && (
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3].map((r) => (
                          <Button
                            key={r}
                            variant={winnerRank1 === r ? "default" : "outline"}
                            size="sm"
                            className={`h-7 px-2 text-[9px] uppercase font-bold tracking-tighter transition-all ${
                              winnerRank1 === r ? getRankColor(r) : 'text-muted-foreground'
                            }`}
                            onClick={() => setWinnerRank1(winnerRank1 === r ? null : r)}
                          >
                            Juara {r}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-xl sm:text-3xl font-black text-muted-foreground/20 italic">VS</div>

                <div className="flex flex-col items-center flex-1 min-w-0">
                  <h3 className="font-bold text-xs sm:text-xl text-center line-clamp-1 mb-1">
                    {match.team2?.name || "TBD"}
                  </h3>
                                 {/* Players List Team 2 */}
                  {(match.team2 as CompetitionTeamWithMembers)?.members && (match.team2 as CompetitionTeamWithMembers).members!.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-3 max-w-[200px]">
                      {(match.team2 as CompetitionTeamWithMembers).members!.map((m) => (
                        <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                          {m.profile?.full_name || "Pemain"}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted w-24 h-24 sm:w-[180px] sm:h-24 rounded-xl sm:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
                      <span className="text-5xl sm:text-6xl font-black tracking-tighter z-10">{score2}</span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0" onClick={() => setScore2(s => Math.max(0, s - 1))}>
                          <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                        <Button variant="default" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0 shadow-md" onClick={() => setScore2(s => s + 1)}>
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                      </div>
                    )}
                    {/* Rank Selection Team 2 */}
                    {!readOnly && (
                      <div className="flex gap-1 mt-2">
                        {[1, 2, 3].map((r) => (
                          <Button
                            key={r}
                            variant={winnerRank2 === r ? "default" : "outline"}
                            size="sm"
                            className={`h-7 px-2 text-[9px] uppercase font-bold tracking-tighter transition-all ${
                              winnerRank2 === r ? getRankColor(r) : 'text-muted-foreground'
                            }`}
                            onClick={() => setWinnerRank2(winnerRank2 === r ? null : r)}
                          >
                            Juara {r}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 p-6 pt-2 shrink-0 bg-muted/5 border-t">
          {!readOnly ? (
            <>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto h-11" 
                onClick={handleUpdateProgress}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simpan Sementara
              </Button>
              <Button 
                variant="default" 
                className="w-full sm:flex-1 h-11 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 font-bold" 
                onClick={handleFinishMatch}
                disabled={updateMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {is17an ? "Selesaikan Sesi" : "Selesaikan Pertandingan"}
              </Button>
            </>
          ) : (
            <Button 
              variant="outline" 
              className="w-full h-11 font-bold" 
              onClick={() => onOpenChange(false)}
            >
              Tutup
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
