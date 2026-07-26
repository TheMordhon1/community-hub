import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { parseMemberName, capitalizeName } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, Star, User, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import type { EventCompetitionWithDetails, CompetitionMatchParticipant, CompetitionMatchWithTeams, CompetitionTeamWithMembers } from "@/types/competition";
import { TeamFlag } from "./TeamFlag";
import { extractFlagAndName } from "@/lib/countries";

interface WinnerAnnounceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
  maxRankToShow?: number;
  match?: CompetitionMatchWithTeams | null;
}

export function WinnerAnnounceDialog({
  open,
  onOpenChange,
  competition,
  maxRankToShow = 3,
  match,
}: WinnerAnnounceDialogProps) {
  const is17an = competition.format === "17an";

  let juara1: CompetitionMatchParticipant[] = [];
  let juara2: CompetitionMatchParticipant[] = [];
  let juara3: CompetitionMatchParticipant[] = [];
  
  const [showOpponent, setShowOpponent] = useState(false);
  const opponentRef = useRef<HTMLDivElement>(null);
  let fullLoserTeam: CompetitionTeamWithMembers | any | null = null;

  const isFinalMatch = match?.is_final === true;
  const isMatchAnnounce = !!match && !isFinalMatch;

  if (match && !isFinalMatch) {
    if (is17an) {
      const winners = match.participants?.filter(p => p.is_winner || p.winner_rank === 1) || [];
      juara1 = winners.map(w => {
        const fullTeam = competition.teams?.find(t => t.id === w.team_id) || w.team;
        return {
          id: w.id,
          team: fullTeam,
          winner_rank: 1
        } as CompetitionMatchParticipant;
      });
    } else {
      const setsWon1 = Array.isArray(match.sets_data)
        ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length
        : 0;
      const setsWon2 = Array.isArray(match.sets_data)
        ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length
        : 0;
      const isTeam1Winner = match.winner_id === match.team1_id || (match.winner_id === null && setsWon1 > setsWon2);
      const isTeam2Winner = match.winner_id === match.team2_id || (match.winner_id === null && setsWon2 > setsWon1);
      const winnerTeam = isTeam1Winner ? match.team1 : (isTeam2Winner ? match.team2 : null);

      if (winnerTeam) {
        const fullTeam = competition.teams?.find(t => t.id === winnerTeam.id) || winnerTeam;
        juara1 = [{
          id: `match-winner-${fullTeam.id}`,
          team: fullTeam,
          winner_rank: 1
        } as CompetitionMatchParticipant];
      }
      
      const loserTeam = isTeam1Winner ? match.team2 : (isTeam2Winner ? match.team1 : null);
      if (loserTeam) {
        fullLoserTeam = competition.teams?.find(t => t.id === loserTeam.id) || loserTeam;
      }
    }
  } else {
    // Competition-wide or Final Match Announcement
    const allParticipants = competition.matches?.flatMap(m => m.participants || []) || [];
    
    // If it's the final match, we use the match result for Juara 1 and 2
    if (isFinalMatch && match) {
      const setsWon1 = Array.isArray(match.sets_data)
        ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length
        : 0;
      const setsWon2 = Array.isArray(match.sets_data)
        ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length
        : 0;
      const isTeam1Winner = match.winner_id === match.team1_id || (match.winner_id === null && setsWon1 > setsWon2);
      const isTeam2Winner = match.winner_id === match.team2_id || (match.winner_id === null && setsWon2 > setsWon1);
      const winnerTeam = isTeam1Winner ? match.team1 : (isTeam2Winner ? match.team2 : null);
      const loserTeam = isTeam1Winner ? match.team2 : (isTeam2Winner ? match.team1 : null);

      if (winnerTeam) {
        const fullTeam = competition.teams?.find(t => t.id === winnerTeam.id) || winnerTeam;
        juara1 = [{ id: `final-winner-${fullTeam.id}`, team: fullTeam, winner_rank: 1 } as CompetitionMatchParticipant];
      }
      if (loserTeam) {
        const fullTeam = competition.teams?.find(t => t.id === loserTeam.id) || loserTeam;
        juara2 = [{ id: `final-loser-${fullTeam.id}`, team: fullTeam, winner_rank: 2 } as CompetitionMatchParticipant];
      }
    }
    const winnersByRank = (rank: number) => {
      const winners = allParticipants.filter(p => p.winner_rank === rank);
      const uniqueTeams = new Map();
      winners.forEach(w => {
        if (w.team_id && !uniqueTeams.has(w.team_id)) {
          const fullTeam = competition.teams?.find(t => t.id === w.team_id);
          uniqueTeams.set(w.team_id, {
            ...w,
            team: fullTeam || w.team
          });
        }
      });
      return Array.from(uniqueTeams.values());
    };

    if (!isFinalMatch) {
      juara1 = winnersByRank(1);
      juara2 = winnersByRank(2);
    }
    juara3 = winnersByRank(3);

    // Fallback if juara1 is still empty (from competition view)
    if (juara1.length === 0 && !isFinalMatch) {
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

  const hasWinners = isMatchAnnounce
    ? (juara1.length > 0)
    : ((juara1.length > 0 && maxRankToShow >= 1) || 
       (juara2.length > 0 && maxRankToShow >= 2) || 
       (juara3.length > 0 && maxRankToShow >= 3));

  if (!hasWinners && open) {
     return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-md text-center py-12">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">
              {isMatchAnnounce ? "Hasil Seri / Seri" : "Belum Ada Pemenang"}
            </h3>
            <p className="text-muted-foreground mt-2">
              {isMatchAnnounce 
                ? "Pertandingan ini berakhir seri tanpa pemenang tunggal." 
                : "Pemenang akan muncul di sini setelah babak final selesai."}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6">Tutup</Button>
          </DialogContent>
        </Dialog>
     );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-primary/5 via-background to-background border-none shadow-2xl p-0 overflow-y-auto max-h-[90vh] [&>button]:z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
        
        <DialogHeader className="p-5 sm:p-8 sm:pb-2 text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 12, stiffness: 200 }}
            className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-primary/20 shadow-inner"
          >
            <Trophy className="w-10 h-10 text-primary" />
          </motion.div>
          <DialogTitle className="text-3xl md:text-4xl font-black tracking-tight text-center">
            {isMatchAnnounce ? "PEMENANG PERTANDINGAN" : "PENGUMUMAN PEMENANG"}
          </DialogTitle>
          <p className="text-muted-foreground text-center font-medium uppercase tracking-[0.2em] text-xs mt-2">
            {isMatchAnnounce && match?.team1 && match?.team2
              ? `${competition.sport_name} • ${match.phase_label || match.stage || "PERTANDINGAN"} • ${match.team1.name} VS ${match.team2.name}`
              : isFinalMatch && match?.team1 && match?.team2 
                ? `${competition.sport_name} • FINAL • ${match.team1.name} VS ${match.team2.name}`
                : competition.sport_name}
          </p>
        </DialogHeader>

        <div className="px-5 sm:px-8 pb-5 sm:pb-8 relative z-10">
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
                <div className="relative bg-white dark:bg-slate-900 border-2 border-yellow-500/50 rounded-3xl p-5 sm:p-8 shadow-2xl flex flex-col items-center justify-center overflow-hidden text-center">
                  <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
                  <div className="absolute right-0 top-0 -mr-8 -mt-8 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute left-0 bottom-0 -ml-8 -mb-8 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="relative mb-5 z-10">
                    <div className="w-20 h-20 bg-yellow-500 rounded-2xl flex items-center justify-center shadow-xl transform -rotate-3 group-hover:rotate-0 transition-transform duration-500">
                      <Trophy className="w-10 h-10 text-white fill-white" />
                    </div>
                    <div className="absolute -top-3 -right-3 bg-black text-white text-[10px] font-black px-3 py-1 rounded-full border border-yellow-500 uppercase tracking-wider shadow-md">
                       {isMatchAnnounce ? "pemenang" : "juara 1"}
                    </div>
                  </div>
                  
                  <h3 className="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-6 relative z-10 flex items-center justify-center gap-3">
                    {p.team && <TeamFlag team={p.team} className="w-10 h-7 object-cover rounded shadow-md inline-block select-none border border-yellow-500/30 shrink-0 text-3xl" fallbackSize="text-4xl" />}
                    <span>{p.team ? extractFlagAndName(p.team.name).name : ""}</span>
                  </h3>
                  
                  <div className="flex flex-wrap justify-center gap-4 w-full relative z-10">
                    {(p.team as CompetitionTeamWithMembers)?.members && (p.team as CompetitionTeamWithMembers).members!.length > 0 ? (
                      (p.team as CompetitionTeamWithMembers).members!.map((m) => {
                        const parsed = parseMemberName(m.name);
                        const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Anonim");
                        const avatarUrl = parsed.avatarUrl || m.profile?.avatar_url || "";
                        return (
                          <div key={m.id} className="flex flex-col bg-white/60 dark:bg-slate-900/40 border border-yellow-500/20 rounded-2xl p-1.5 shadow-sm hover:shadow-md transition-shadow flex-1 min-w-[110px] max-w-[180px]">
                            <div className="w-full aspect-square rounded-[10px] bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2 border border-yellow-500/10">
                              <Avatar className="w-full h-full rounded-none">
                                <AvatarImage src={avatarUrl || ""} alt={name} className="object-cover" />
                                <AvatarFallback className="rounded-none bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-4xl font-bold text-slate-500">
                                  {name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-center px-1 pb-1 line-clamp-2 leading-tight">
                              {name}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-bold text-yellow-600 uppercase tracking-widest">Pemenang Utama</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {isMatchAnnounce && fullLoserTeam && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-2 flex flex-col items-center"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOpponent(!showOpponent)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground mb-4 uppercase tracking-wider"
                >
                  {showOpponent ? "Sembunyikan Lawan" : "Tampilkan Lawan"}
                  {showOpponent ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </Button>

                <AnimatePresence>
                  {showOpponent && (
                    <motion.div
                      ref={opponentRef}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="w-full overflow-hidden"
                      onAnimationComplete={() => {
                        if (showOpponent && opponentRef.current) {
                          opponentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }}
                    >
                      <div className="h-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group max-w-md mx-auto">
                        <h4 className="text-xl font-bold tracking-tight leading-tight mb-4 relative z-10 flex items-center justify-center gap-2">
                          <TeamFlag team={fullLoserTeam} className="w-6 h-4 object-cover rounded shadow-sm inline-block select-none border border-slate-300 dark:border-slate-700 shrink-0 text-xl" fallbackSize="text-2xl" />
                          <span>{extractFlagAndName(fullLoserTeam.name).name}</span>
                        </h4>
                        
                        <div className="flex flex-wrap justify-center gap-3 w-full relative z-10">
                          {fullLoserTeam.members && fullLoserTeam.members.length > 0 ? (
                            fullLoserTeam.members.map((m: any) => {
                              const parsed = parseMemberName(m.name);
                              const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Anonim");
                              const avatarUrl = parsed.avatarUrl || m.profile?.avatar_url || "";
                            
                              return (
                                <div key={m.id} className="flex flex-col bg-white/50 dark:bg-slate-900/30 border border-slate-300 dark:border-slate-600 rounded-xl p-1.5 shadow-sm flex-1 min-w-[90px] max-w-[140px] opacity-80">
                                  <div className="w-full aspect-square rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden mb-1.5 border border-slate-300/50 dark:border-slate-600/50 transition-all">
                                    {avatarUrl ? (
                                      <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <User className="w-1/3 h-1/3 text-slate-400" />
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center line-clamp-2 leading-tight px-0.5">
                                    {name}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Peserta</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Juara 2 & 3 - Side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {maxRankToShow >= 2 && juara2.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="h-full bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="w-14 h-14 bg-slate-400 rounded-2xl flex items-center justify-center shadow-md mb-4 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500 z-10 relative">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 relative z-10">Juara 2</p>
                    <h4 className="text-xl font-bold tracking-tight leading-tight mb-4 relative z-10 flex items-center justify-center gap-2">
                      {p.team && <TeamFlag team={p.team} className="w-6 h-4 object-cover rounded shadow-sm inline-block select-none border border-slate-300 dark:border-slate-700 shrink-0 text-xl" fallbackSize="text-2xl" />}
                      <span>{p.team ? extractFlagAndName(p.team.name).name : ""}</span>
                    </h4>
                    <div className="flex flex-wrap justify-center gap-3 w-full relative z-10">
                      {(p.team as CompetitionTeamWithMembers)?.members && (p.team as CompetitionTeamWithMembers).members!.length > 0 ? (
                        (p.team as CompetitionTeamWithMembers).members!.map((m) => {
                          const parsed = parseMemberName(m.name);
                          const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Anonim");
                          const avatarUrl = parsed.avatarUrl || m.profile?.avatar_url || "";
                          const shortName = name.split(' ')[0] || "Anonim";
                          return (
                            <div key={m.id} className="flex flex-col bg-white/50 dark:bg-slate-900/30 border border-slate-300 dark:border-slate-600 rounded-xl p-1.5 shadow-sm flex-1 min-w-[90px] max-w-[140px]">
                              <div className="w-full aspect-square rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden mb-1.5 border border-slate-300/50 dark:border-slate-600/50">
                                <Avatar className="w-full h-full rounded-none">
                                  <AvatarImage src={avatarUrl || ""} alt={name} className="object-cover" />
                                  <AvatarFallback className="rounded-none bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500">
                                    {name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center line-clamp-2 leading-tight px-0.5">
                                {shortName}
                              </span>
                            </div>
                          );
                        })
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
                >
                  <div className="h-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                    <div className="w-14 h-14 bg-amber-600 rounded-2xl flex items-center justify-center shadow-md mb-4 transform -rotate-3 group-hover:rotate-0 transition-transform duration-500 z-10 relative">
                      <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1 relative z-10">Juara 3</p>
                    <h4 className="text-xl font-bold tracking-tight leading-tight mb-4 relative z-10 flex items-center justify-center gap-2">
                      {p.team && <TeamFlag team={p.team} className="w-6 h-4 object-cover rounded shadow-sm inline-block select-none border border-amber-200 dark:border-amber-800 shrink-0 text-xl" fallbackSize="text-2xl" />}
                      <span>{p.team ? extractFlagAndName(p.team.name).name : ""}</span>
                    </h4>
                    <div className="flex flex-wrap justify-center gap-3 w-full relative z-10">
                      {(p.team as CompetitionTeamWithMembers)?.members && (p.team as CompetitionTeamWithMembers).members!.length > 0 ? (
                        (p.team as CompetitionTeamWithMembers).members!.map((m) => {
                          const parsed = parseMemberName(m.name);
                          const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Anonim");
                          const avatarUrl = parsed.avatarUrl || m.profile?.avatar_url || "";
                          const shortName = name.split(' ')[0] || "Anonim";
                          return (
                            <div key={m.id} className="flex flex-col bg-white/50 dark:bg-slate-900/30 border border-amber-300/50 dark:border-amber-700/50 rounded-xl p-1.5 shadow-sm flex-1 min-w-[90px] max-w-[140px]">
                              <div className="w-full aspect-square rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden mb-1.5 border border-amber-300/30 dark:border-amber-700/30">
                                <Avatar className="w-full h-full rounded-none">
                                  <AvatarImage src={avatarUrl || ""} alt={name} className="object-cover" />
                                  <AvatarFallback className="rounded-none bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500">
                                    {name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <span className="text-xs font-bold text-amber-800 dark:text-amber-200 text-center line-clamp-2 leading-tight px-0.5">
                                {shortName}
                              </span>
                            </div>
                          );
                        })
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

        <div className="px-5 sm:px-8 pb-5 sm:pb-8 flex items-center gap-3 relative z-10">
          <Button 
            className="flex-1 h-12 text-base font-bold shadow-lg"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
