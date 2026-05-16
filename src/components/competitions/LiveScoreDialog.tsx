import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Trophy } from "lucide-react";
import { useUpdateMatch } from "@/hooks/useCompetitions";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails } from "@/types/competition";
import { toast } from "@/hooks/use-toast";

interface LiveScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: CompetitionMatchWithTeams | null;
  competition: EventCompetitionWithDetails;
}

export function LiveScoreDialog({
  open,
  onOpenChange,
  match,
  competition,
}: LiveScoreDialogProps) {
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);

  const updateMutation = useUpdateMatch();

  useEffect(() => {
    if (match && open) {
      // Initialize from match data, fallback to local cache if exists
      const cached = localStorage.getItem(`live_score_${match.id}`);
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
  }, [match, open]);

  // Sync to cache on change
  useEffect(() => {
    if (match && open) {
      localStorage.setItem(
        `live_score_${match.id}`,
        JSON.stringify({ score1, score2 })
      );
    }
  }, [score1, score2, match, open]);

  const handleUpdateProgress = () => {
    if (!match) return;

    updateMutation.mutate(
      {
        id: match.id,
        competition_id: competition.id,
        score1: score1.toString(),
        score2: score2.toString(),
        status: "ongoing", // Set status to ongoing when score is being updated
      },
      {
        onSuccess: () => {
          toast({
            title: "Tersimpan",
            description: "Skor sementara berhasil disimpan.",
          });
        },
      }
    );
  };

  const handleFinishMatch = () => {
    if (!match) return;

    let winnerId = null;
    if (score1 > score2) {
      winnerId = match.team1_id;
    } else if (score2 > score1) {
      winnerId = match.team2_id;
    }

    updateMutation.mutate(
      {
        id: match.id,
        competition_id: competition.id,
        score1: score1.toString(),
        score2: score2.toString(),
        status: "completed",
        winner_id: winnerId,
      },
      {
        onSuccess: () => {
          // Clear cache
          localStorage.removeItem(`live_score_${match.id}`);
          onOpenChange(false);
          toast({
            title: "Pertandingan Selesai",
            description: "Hasil akhir berhasil disimpan.",
          });
        },
      }
    );
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Live Score Pertandingan</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            {competition.sport_name} - Babak {match.round_number} (Match {match.match_number})
          </p>
        </DialogHeader>

        <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Team 1 Score */}
          <div className="flex flex-col items-center flex-1 w-full gap-4">
            <h3 className="font-semibold text-lg text-center h-12 flex items-center justify-center">
              {match.team1?.name || "TBD"}
            </h3>
            <div className="bg-muted w-full aspect-square rounded-2xl flex items-center justify-center relative overflow-hidden">
              <span className="text-7xl font-bold tracking-tighter z-10">{score1}</span>
              {score1 > score2 && (
                <div className="absolute inset-0 bg-primary/10"></div>
              )}
            </div>
            <div className="flex items-center gap-2 w-full">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full shrink-0"
                onClick={() => setScore1(s => Math.max(0, s - 1))}
              >
                <Minus className="w-6 h-6" />
              </Button>
              <Button 
                variant="default" 
                className="h-12 flex-1 rounded-full text-lg"
                onClick={() => setScore1(s => s + 1)}
              >
                <Plus className="w-6 h-6 mr-1" /> Point
              </Button>
            </div>
          </div>

          <div className="text-4xl font-black text-muted-foreground/30 hidden md:block">VS</div>

          {/* Team 2 Score */}
          <div className="flex flex-col items-center flex-1 w-full gap-4">
            <h3 className="font-semibold text-lg text-center h-12 flex items-center justify-center">
              {match.team2?.name || "TBD"}
            </h3>
            <div className="bg-muted w-full aspect-square rounded-2xl flex items-center justify-center relative overflow-hidden">
              <span className="text-7xl font-bold tracking-tighter z-10">{score2}</span>
              {score2 > score1 && (
                <div className="absolute inset-0 bg-primary/10"></div>
              )}
            </div>
            <div className="flex items-center gap-2 w-full">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full shrink-0"
                onClick={() => setScore2(s => Math.max(0, s - 1))}
              >
                <Minus className="w-6 h-6" />
              </Button>
              <Button 
                variant="default" 
                className="h-12 flex-1 rounded-full text-lg"
                onClick={() => setScore2(s => s + 1)}
              >
                <Plus className="w-6 h-6 mr-1" /> Point
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto" 
            onClick={handleUpdateProgress}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Simpan Progress (Live)
          </Button>
          <Button 
            variant="default" 
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white" 
            onClick={handleFinishMatch}
            disabled={updateMutation.isPending}
          >
            <Trophy className="w-4 h-4 mr-2" />
            Selesai Pertandingan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
