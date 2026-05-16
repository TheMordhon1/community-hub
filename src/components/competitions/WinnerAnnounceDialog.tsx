import { useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Star, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import type { EventCompetitionWithDetails, CompetitionMatchParticipant } from "@/types/competition";

interface WinnerAnnounceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
  maxRankToShow?: number;
}

export function WinnerAnnounceDialog({
  open,
  onOpenChange,
  competition,
  maxRankToShow = 3,
}: WinnerAnnounceDialogProps) {
  // Extract winners from all matches
  const allParticipants = competition.matches?.flatMap(m => m.participants || []) || [];
  
  // Get unique winners by rank
  const winnersByRank = (rank: number) => {
    const winners = allParticipants.filter(p => p.winner_rank === rank);
    // Return unique teams
    const uniqueTeams = new Map();
    winners.forEach(w => {
      if (w.team_id && !uniqueTeams.has(w.team_id)) {
        // Find full team with members from competition.teams
        const fullTeam = competition.teams?.find(t => t.id === w.team_id);
        uniqueTeams.set(w.team_id, {
          ...w,
          team: fullTeam || w.team
        });
      }
    });
    return Array.from(uniqueTeams.values());
  };

  const juara1 = winnersByRank(1);
  const juara2 = winnersByRank(2);
  const juara3 = winnersByRank(3);

  // Fallback: If no Juara 1 but there's a final match with a winner_id
  if (juara1.length === 0) {
    const finalMatch = competition.matches?.find(m => m.is_final && m.status === 'completed' && m.winner_id);
    if (finalMatch) {
      const winnerTeam = competition.teams?.find(t => t.id === finalMatch.winner_id);
      if (winnerTeam) {
        juara1.push({
          id: `fallback-${winnerTeam.id}`,
          match_id: finalMatch.id,
          team_id: winnerTeam.id,
          team: winnerTeam,
          winner_rank: 1,
          is_winner: true,
          score: finalMatch.score1,
          created_at: finalMatch.created_at
        } as CompetitionMatchParticipant);
      }
    }
  }

  useEffect(() => {
    if (open) {
      // Primary burst
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      // School pride burst
      const end = Date.now() + (3 * 1000);
      const colors = ['#fbbf24', '#94a3b8', '#d97706'];

      (function frame() {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      // Play victory sounds (Sports Whistle + User's Clapping Asset)
      const whistle = new Audio("https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3");
      const clapping = new Audio("/sound/clapping.wav");
      
      whistle.volume = 0.6;
      clapping.volume = 0.7;

      whistle.play().catch(err => console.log("Whistle play failed:", err));
      
      // Play local clapping asset
      setTimeout(() => {
        clapping.play().catch(err => console.log("Clapping play failed:", err));
      }, 200);
    }
  }, [open]);

  const hasWinners = (juara1.length > 0 && maxRankToShow >= 1) || 
                     (juara2.length > 0 && maxRankToShow >= 2) || 
                     (juara3.length > 0 && maxRankToShow >= 3);

  if (!hasWinners && open) {
     return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md text-center py-12">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">Belum Ada Pemenang</h3>
            <p className="text-muted-foreground mt-2">Pemenang akan muncul di sini setelah babak final selesai.</p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">Tutup</Button>
          </DialogContent>
        </Dialog>
     );
  }

  return (
    <Dialog open={open} onOpenChange={() =>onOpenChange(false)}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-primary/5 via-background to-background border-none shadow-2xl p-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
        
        <DialogHeader className="p-8 pb-2 text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary/20 shadow-inner"
          >
            <Trophy className="w-10 h-10 text-primary" />
          </motion.div>
          <DialogTitle className="text-3xl md:text-4xl font-black tracking-tight text-center">
            PENGUMUMAN PEMENANG
          </DialogTitle>
          <p className="text-muted-foreground text-center font-medium uppercase tracking-[0.2em] text-xs mt-2">
            {competition.sport_name}
          </p>
        </DialogHeader>

        <div className="p-6 md:p-8 relative z-10">
          <div className="flex flex-col gap-6">
            {/* Juara 1 - Highlight */}
            {juara1.map((p, idx) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative group"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 animate-pulse" />
                <div className="relative bg-white dark:bg-slate-900 border-2 border-yellow-500/50 rounded-2xl p-6 shadow-xl flex items-center justify-between overflow-hidden">
                  <div className="absolute right-0 top-0 -mr-8 -mt-8 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl" />
                  <div className="flex items-center gap-6">
                    <div className="relative">
                       <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                        <Trophy className="w-10 h-10 text-white fill-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-yellow-500">
                         juara 1
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-black tracking-tight leading-tight mb-1 truncate">
                        {p.team?.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {p.team?.members && p.team.members.length > 0 ? (
                          p.team.members.map((m) => (
                            <div key={m.id} className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full pl-1 pr-2 py-0.5">
                              <Avatar className="w-5 h-5 border border-yellow-500/30">
                                <AvatarImage src={m.profile?.avatar_url || ""} />
                                <AvatarFallback className="text-[8px] bg-yellow-500 text-white">
                                  {m.profile?.full_name?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] font-bold text-yellow-700 truncate max-w-[80px]">
                                {m.profile?.full_name || "Anonim"}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest">Pemenang Utama</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Juara 2 & 3 - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {maxRankToShow >= 2 && juara2.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-xl p-5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-slate-400 rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <Medal className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Juara 2</p>
                    <h4 className="text-lg font-bold truncate tracking-tight leading-tight mb-1">{p.team?.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {p.team?.members && p.team.members.length > 0 ? (
                        p.team.members.map((m) => (
                          <div key={m.id} className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-full pl-0.5 pr-1.5 py-0.5">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={m.profile?.avatar_url || ""} />
                              <AvatarFallback className="text-[6px]">{m.profile?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[60px]">
                              {m.profile?.full_name?.split(' ')[0] || "Anonim"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Pemenang Tim</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {maxRankToShow >= 3 && juara3.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-5 flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
                    <Medal className="w-7 h-7 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Juara 3</p>
                    <h4 className="text-lg font-bold truncate tracking-tight leading-tight mb-1">{p.team?.name}</h4>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {p.team?.members && p.team.members.length > 0 ? (
                        p.team.members.map((m) => (
                          <div key={m.id} className="flex items-center gap-1 bg-amber-200/50 dark:bg-amber-900/30 border border-amber-300/50 dark:border-amber-700/50 rounded-full pl-0.5 pr-1.5 py-0.5">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={m.profile?.avatar_url || ""} />
                              <AvatarFallback className="text-[6px]">{m.profile?.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[9px] font-medium text-amber-700 dark:text-amber-300 truncate max-w-[60px]">
                              {m.profile?.full_name?.split(' ')[0] || "Anonim"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-amber-400 italic">Pemenang Tim</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 pt-2 flex items-center gap-3 relative z-10">
          <Button 
            className="flex-1 h-12 text-base font-bold shadow-lg"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl">
             <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
