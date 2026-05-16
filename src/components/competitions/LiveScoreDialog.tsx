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
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails } from "@/types/competition";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface LiveScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: CompetitionMatchWithTeams | null;
  competition: EventCompetitionWithDetails;
}

interface ParticipantScore {
  id: string;
  score: number;
  isWinner: boolean;
  rank: number | null;
}

export function LiveScoreDialog({
  open,
  onOpenChange,
  match,
  competition,
}: LiveScoreDialogProps) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
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
                rank: p.winner_rank || null
              })));
            }
          } catch {
            setParticipantScores(match.participants.map(p => ({
              id: p.id,
              score: parseInt(p.score || "0", 10),
              isWinner: p.is_winner || false,
              rank: p.winner_rank || null
            })));
          }
        } else {
          setParticipantScores(match.participants.map(p => ({
            id: p.id,
            score: parseInt(p.score || "0", 10),
            isWinner: p.is_winner || false,
            rank: p.winner_rank || null
          })));
        }
      } else {
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setScore1(parsed.score1 || 0);
            setScore2(parsed.score2 || 0);
          } catch {
            setScore1(parseInt(match.score1 || "0", 10) || 0);
            setScore2(parseInt(match.score2 || "0", 10) || 0);
          }
        } else {
          setScore1(parseInt(match.score1 || "0", 10) || 0);
          setScore2(parseInt(match.score2 || "0", 10) || 0);
        }
      }
    }
  }, [match, open]);

  useEffect(() => {
    if (match && open) {
      const data = match.participants && match.participants.length > 0
        ? { participants: participantScores }
        : { score1, score2 };
      
      localStorage.setItem(`live_score_${match.id}`, JSON.stringify(data));
    }
  }, [score1, score2, participantScores, match, open]);

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
            is_winner: ps.isWinner,
            winner_rank: ps.rank
          }))
        : undefined,
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
            winner_rank: ps.rank
          }))
        : undefined,
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
      p.id === id ? { ...p, isWinner: !p.isWinner, rank: !p.isWinner ? p.rank : null } : p
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
      <DialogContent className="max-w-md sm:max-w-lg overflow-auto flex flex-col max-h-[95vh] p-0">
        <DialogHeader className="shrink-0 p-6 pb-2">
          <DialogTitle className="text-center text-xl">
            {is17an ? "Pencatatan Hasil Sesi" : "Live Score Pertandingan"}
          </DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            {competition.sport_name} - {match.phase_label || (is17an ? `Sesi ${match.match_number}` : `Babak ${match.round_number} (Match ${match.match_number})`)}
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
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className={`w-4 h-4 ${ps.isWinner ? 'text-primary' : 'text-muted-foreground'}`} />
                              <h3 className={`font-bold text-base truncate ${ps.isWinner ? 'text-primary' : ''}`}>
                                {participant?.team?.name}
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {ps.isWinner && (
                                <Badge variant="default" className="bg-primary text-[10px] h-5 px-1.5 animate-in fade-in zoom-in duration-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  {is17an ? "Lolos" : "Pemenang"}
                                </Badge>
                              )}
                              {ps.rank && (
                                <Badge className={`${getRankColor(ps.rank)} text-[10px] h-5 px-1.5 shadow-sm animate-in fade-in slide-in-from-left-1 duration-300`}>
                                  <Medal className="w-3 h-3 mr-1" />
                                  {getRankLabel(ps.rank)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Skor</span>
                              <div className="flex items-center gap-1.5 bg-background border rounded-lg p-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-md"
                                  onClick={() => updateParticipantScore(ps.id, -1)}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>
                                <span className="w-8 text-center font-bold font-mono text-lg">{ps.score}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-md"
                                  onClick={() => updateParticipantScore(ps.id, 1)}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <Button
                              variant={ps.isWinner ? "default" : "outline"}
                              size="icon"
                              className={`h-12 w-12 rounded-xl transition-all duration-300 ${
                                ps.isWinner ? 'bg-primary shadow-lg shadow-primary/20' : 'hover:border-primary/50'
                              }`}
                              onClick={() => toggleParticipantWinner(ps.id)}
                            >
                              <Trophy className={`w-6 h-6 ${ps.isWinner ? 'fill-current' : ''}`} />
                            </Button>
                          </div>
                        </div>

                        {/* Rank Selection - Only show if it's a Final session */}
                        {match.phase_label?.toLowerCase().includes("final") && (
                          <div className="flex gap-2 pt-2 border-t border-dashed">
                            {[1, 2, 3].map((r) => (
                              <Button
                                key={r}
                                variant={ps.rank === r ? "default" : "outline"}
                                size="sm"
                                className={`flex-1 h-8 text-[10px] font-bold gap-1 transition-all duration-300 ${
                                  ps.rank === r ? getRankColor(r) : 'text-muted-foreground hover:text-primary hover:border-primary/50'
                                }`}
                                onClick={() => setParticipantRank(ps.id, ps.rank === r ? null : r)}
                              >
                                <Medal className="w-3 h-3" />
                                Juara {r}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="py-4 sm:py-8 flex flex-col xs:flex-row items-center justify-between gap-4 sm:gap-6">
              {/* Team 1 Score */}
              <div className="flex flex-row xs:flex-col items-center justify-between xs:justify-start flex-1 w-full gap-4">
                <div className="flex flex-col items-center xs:w-full flex-1 min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-center h-auto xs:h-12 flex items-center justify-center line-clamp-2 leading-tight mb-2 xs:mb-0">
                    {match.team1?.name || "TBD"}
                  </h3>
                  <div className="bg-muted w-20 h-20 md:w-full md:aspect-square md:max-w-[140px] md:h-full rounded-2xl md:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500">
                    <span className="text-3xl xs:text-5xl md:text-7xl font-black tracking-tighter z-10">{score1}</span>
                    {score1 > score2 && (
                      <div className="absolute inset-0 bg-primary/10 animate-pulse"></div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0"
                    onClick={() => setScore1(s => Math.max(0, s - 1))}
                  >
                    <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                  <Button 
                    variant="default" 
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl p-0 shadow-md"
                    onClick={() => setScore1(s => s + 1)}
                  >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>
              </div>

              <div className="text-xl xs:text-3xl font-black text-muted-foreground/20 italic rotate-90 xs:rotate-0">VS</div>

              {/* Team 2 Score */}
              <div className="flex flex-row-reverse xs:flex-col items-center justify-between xs:justify-start flex-1 w-full gap-4">
                <div className="flex flex-col items-center xs:w-full flex-1 min-w-0">
                  <h3 className="font-bold text-base sm:text-lg text-center h-auto xs:h-12 flex items-center justify-center line-clamp-2 leading-tight mb-2 xs:mb-0">
                    {match.team2?.name || "TBD"}
                  </h3>
                  <div className="bg-muted w-20 h-20 md:w-full md:aspect-square md:max-w-[140px] md:h-full rounded-2xl md:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500">
                    <span className="text-3xl xs:text-5xl md:text-7xl font-black tracking-tighter z-10">{score2}</span>
                    {score2 > score1 && (
                      <div className="absolute inset-0 bg-primary/10 animate-pulse"></div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0"
                    onClick={() => setScore2(s => Math.max(0, s - 1))}
                  >
                    <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                  <Button 
                    variant="default" 
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl p-0 shadow-md"
                    onClick={() => setScore2(s => s + 1)}
                  >
                    <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 p-6 pt-2 shrink-0 bg-muted/5 border-t">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
