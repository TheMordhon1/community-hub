import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, Trophy, Users, CheckCircle2, Medal, RefreshCw, RotateCcw, Edit } from "lucide-react";
import { useUpdateMatch, useResetMatch } from "@/hooks/useCompetitions";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { WinnerAnnounceDialog } from "./WinnerAnnounceDialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { parseMemberName, capitalizeName, cn } from "@/lib/utils";
import { TeamFlag } from "./TeamFlag";
import { extractFlagAndName } from "@/lib/countries";


interface LiveScoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: CompetitionMatchWithTeams | null;
  competition: EventCompetitionWithDetails;
  readOnly?: boolean;
  onEditMatch?: (match: CompetitionMatchWithTeams) => void;
  canManage?: boolean;
}

interface ParticipantScore {
  id: string;
  score: number;
  isWinner: boolean;
  winner_rank: number | null;
}


interface SetScore {
  set_number: number;
  score1: number;
  score2: number;
}

export default function LiveScoreDialog({
  open,
  onOpenChange,
  match: initialMatch,
  competition,
  readOnly = false,
  onEditMatch,
  canManage = false,
}: LiveScoreDialogProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: latestMatch, refetch, isFetching } = useQuery({
    queryKey: ["match-detail-live", initialMatch?.id],
    queryFn: async () => {
      if (!initialMatch?.id) return null;
      const { data: rawMatch, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          team1:competition_teams!team1_id (
            id,
            name,
            logo_url,
            members:competition_team_members(id, name, user_id, house_block, house_number)
          ),
          team2:competition_teams!team2_id (
            id,
            name,
            logo_url,
            members:competition_team_members(id, name, user_id, house_block, house_number)
          ),
          participants:competition_match_participants (
            id,
            team_id,
            score,
            is_winner,
            winner_rank,
            team:competition_teams (
              id,
              name,
              logo_url,
              members:competition_team_members(id, name, user_id, house_block, house_number)
            )
          )
        `)
        .eq("id", initialMatch.id)
        .single();

      if (error) throw error;

      const userIds = new Set<string>();

      if (rawMatch.team1?.members) {
        rawMatch.team1.members.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
      }
      if (rawMatch.team2?.members) {
        rawMatch.team2.members.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
      }
      if (rawMatch.participants) {
        rawMatch.participants.forEach((p) => {
          p.team?.members?.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
        });
      }

      let profileMap = new Map<string, { id: string, full_name: string | null, house?: { block: string; number: string } }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIds));
        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        const { data: residents } = await supabase
          .from("house_residents")
          .select("user_id, house_id")
          .in("user_id", Array.from(userIds));
        const residentHouseIds = [...new Set((residents || []).map((r) => r.house_id).filter(Boolean))] as string[];
        if (residentHouseIds.length > 0) {
          const { data: memberHouses } = await supabase
            .from("houses")
            .select("id, block, number")
            .in("id", residentHouseIds);
          const houseById = new Map((memberHouses || []).map((h) => [h.id, h]));
          (residents || []).forEach((r) => {
            const house = r.house_id ? houseById.get(r.house_id) : null;
            if (house && profileMap.has(r.user_id)) {
              const profile = profileMap.get(r.user_id)!;
              profileMap.set(r.user_id, { ...profile, house: { block: house.block, number: house.number } });
            }
          });
        }
      }

      interface TeamWithOptionalMembers {
        members?: Array<{
          id: string;
          team_id?: string | null;
          user_id?: string | null;
          is_captain?: boolean | null;
          name?: string | null;
          created_at?: string;
          house_block?: string | null;
          house_number?: string | null;
          profile?: {
            full_name?: string | null;
            avatar_url?: string | null;
            house?: {
              block: string;
              number: string;
            };
          };
        }>;
      }

      const attachProfile = (team: TeamWithOptionalMembers | null | undefined) => {
        if (!team || !team.members) return;
        team.members = team.members.map((mem) => {
          if (mem.user_id && profileMap.has(mem.user_id)) {
            const profile = profileMap.get(mem.user_id)!;
            return {
              ...mem,
              profile: {
                full_name: profile.full_name,
                avatar_url: null,
                house: profile.house ? { block: profile.house.block, number: profile.house.number } : undefined
              }
            };
          }
          const manualHouse =
            mem.house_block && mem.house_number
              ? { block: mem.house_block, number: mem.house_number }
              : undefined;
          return {
            ...mem,
            profile: manualHouse ? { house: manualHouse } : undefined,
          };
        });
      };

      attachProfile(rawMatch.team1);
      attachProfile(rawMatch.team2);
      rawMatch.participants?.forEach((p) => attachProfile(p.team));

      return rawMatch as unknown as CompetitionMatchWithTeams;
    },
    enabled: !!initialMatch?.id && open,
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialMatch?.status;
      return (autoRefresh && status !== 'completed') ? 10000 : false;
    },
  });

  const match = (latestMatch || initialMatch) as CompetitionMatchWithTeams;

  useEffect(() => {
    if (open) {
      const isLive = match?.status === "ongoing";
      setAutoRefresh(isLive);
    } else {
      setAutoRefresh(false);
    }
  }, [open, match?.status]);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [winnerRank1, setWinnerRank1] = useState<number | null>(null);
  const [winnerRank2, setWinnerRank2] = useState<number | null>(null);
  const [participantScores, setParticipantScores] = useState<ParticipantScore[]>([]);
  const [sets, setSets] = useState<{ team1_score: number; team2_score: number }[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [isWinnerAnnounceOpen, setIsWinnerAnnounceOpen] = useState(false);
  // Track whether the user has unsaved local edits — if true, remote updates won't overwrite
  const isDirty = useRef(false);
  // Track the last match id we initialized from to detect dialog open/switch
  const lastInitMatchId = useRef<string | null>(null);

  const updateMutation = useUpdateMatch();
  const resetMatchMutation = useResetMatch();

  const handleCircleClick = (idx: number, teamNum: 1 | 2) => {
    if (readOnly) return;
    
    // Create any missing sets up to this index
    let newSets = [...sets];
    while (newSets.length <= idx) {
      newSets.push({ team1_score: 0, team2_score: 0 });
    }
    
    const set = newSets[idx];
    const isPlayed = set.team1_score > 0 || set.team2_score > 0;
    
    if (!isPlayed) {
      // Create/set a match/game score directly
      const defaultWinScore = 21;
      const defaultLoseScore = 19;
      if (teamNum === 1) {
        newSets[idx] = { team1_score: defaultWinScore, team2_score: defaultLoseScore };
      } else {
        newSets[idx] = { team1_score: defaultLoseScore, team2_score: defaultWinScore };
      }
      setSets(newSets);
      setActiveSetIndex(idx);
      isDirty.current = true;
    } else {
      // Already played - show a choice to edit or cancel/delete
      const action = window.confirm(
        `Set ${idx + 1} saat ini bernilai ${set.team1_score} - ${set.team2_score}.\n\n` +
        `Klik OK untuk menghapus/membatalkan game ini (reset ke 0-0).\n` +
        `Klik BATAL untuk tetap mempertahankan skor.`
      );
      if (action) {
        // Hapus/cancel set
        newSets = newSets.map((s, sIdx) => sIdx === idx ? { team1_score: 0, team2_score: 0 } : s);
        setSets(newSets);
        setActiveSetIndex(idx);
        isDirty.current = true;
      } else {
        // Just make it the active set so they can edit
        setActiveSetIndex(idx);
      }
    }
  };

  const handleCancelGame = () => {
    if (!match) return;
    if (window.confirm("Apakah Anda yakin ingin membatalkan/reset pertandingan ini? Seluruh skor dan set akan dihapus, dan status kembali ke terjadwal.")) {
      resetMatchMutation.mutate({
        id: match.id,
        competition_id: competition.id
      }, {
        onSuccess: () => {
          localStorage.removeItem(`live_score_${match.id}`);
          onOpenChange(false);
        }
      });
    }
  };

  const handleEditGame = () => {
    if (onEditMatch && match) {
      onEditMatch(match);
    }
  };

  const is17an = competition.format === "17an";

  const winners17an = is17an
    ? (match?.participants?.filter(p => p.is_winner || p.winner_rank === 1) || [])
    : [];

  const setsWon1 = match && Array.isArray(match.sets_data)
    ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length
    : 0;
  const setsWon2 = match && Array.isArray(match.sets_data)
    ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length
    : 0;
  const isTeam1Winner = match && (match.winner_id === match.team1_id || (match.winner_id === null && setsWon1 > setsWon2));
  const isTeam2Winner = match && (match.winner_id === match.team2_id || (match.winner_id === null && setsWon2 > setsWon1));
  const winnerTeam = (isTeam1Winner ? match?.team1 : (isTeam2Winner ? match?.team2 : null)) as CompetitionTeamWithMembers | null;

  const initFromMatch = (match: CompetitionMatchWithTeams) => {
    const cached = localStorage.getItem(`live_score_${match.id}`);

    if (is17an) {
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
      }
    } else {
      const s1 = parseInt(match.score1 || "0", 10) || 0;
      const s2 = parseInt(match.score2 || "0", 10) || 0;

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setScore1(parsed.score1 || 0);
          setScore2(parsed.score2 || 0);
          setWinnerRank1(parsed.winnerRank1 || null);
          setWinnerRank2(parsed.winnerRank2 || null);
          if (Array.isArray(parsed.sets)) {
            setSets(parsed.sets);
            setActiveSetIndex(parsed.activeSetIndex ?? 0);
          } else {
            setSets([{ team1_score: s1, team2_score: s2 }]);
            setActiveSetIndex(0);
          }
        } catch {
          setScore1(s1);
          setScore2(s2);
          setWinnerRank1(match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank || null);
          setWinnerRank2(match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank || null);
          if (Array.isArray(match.sets_data) && match.sets_data.length > 0) {
            setSets(match.sets_data.map(s => ({ team1_score: s.team1_score ?? 0, team2_score: s.team2_score ?? 0 })));
            setActiveSetIndex(match.sets_data.length - 1);
          } else {
            setSets([{ team1_score: s1, team2_score: s2 }]);
            setActiveSetIndex(0);
          }
        }
      } else {
        setScore1(s1);
        setScore2(s2);
        setWinnerRank1(match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank || null);
        setWinnerRank2(match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank || null);
        if (Array.isArray(match.sets_data) && match.sets_data.length > 0) {
          setSets(match.sets_data.map(s => ({ team1_score: s.team1_score ?? 0, team2_score: s.team2_score ?? 0 })));
          setActiveSetIndex(match.sets_data.length - 1);
        } else {
          setSets([{ team1_score: s1, team2_score: s2 }]);
          setActiveSetIndex(0);
        }
      }
    }
  };

  const syncFromDb = (match: CompetitionMatchWithTeams) => {
    // Sync directly from DB data (no localStorage) — used for remote updates
    if (is17an) {
      if (match.participants && match.participants.length > 0) {
        setParticipantScores(match.participants.map(p => ({
          id: p.id,
          score: parseInt(p.score || "0", 10),
          isWinner: p.is_winner || false,
          winner_rank: p.winner_rank || null
        })));
      }
    } else {
      const s1 = parseInt(match.score1 || "0", 10) || 0;
      const s2 = parseInt(match.score2 || "0", 10) || 0;
      setScore1(s1);
      setScore2(s2);
      setWinnerRank1(match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank || null);
      setWinnerRank2(match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank || null);
      if (Array.isArray(match.sets_data) && match.sets_data.length > 0) {
        setSets(match.sets_data.map(s => ({ team1_score: s.team1_score ?? 0, team2_score: s.team2_score ?? 0 })));
        setActiveSetIndex(match.sets_data.length - 1);
      } else {
        setSets([{ team1_score: s1, team2_score: s2 }]);
        setActiveSetIndex(0);
      }
    }
  };

  useEffect(() => {
    if (match && open) {
      const isNewMatch = lastInitMatchId.current !== match.id;
      if (isNewMatch) {
        // First open or switched to a different match — always init from cache/DB
        isDirty.current = false;
        lastInitMatchId.current = match.id;
        initFromMatch(match);
      } else if (!isDirty.current || readOnly) {
        // Same match, no local edits (or readOnly viewer) — accept remote update
        syncFromDb(match);
      }
      // If isDirty, local user is actively editing → don't overwrite their changes
    }
    if (!open) {
      // Reset dirty flag when dialog closes
      isDirty.current = false;
      lastInitMatchId.current = null;
    }
  }, [match, open, is17an]);

  useEffect(() => {
    if (match && open) {
      const data = is17an
        ? { participants: participantScores }
        : { score1, score2, winnerRank1, winnerRank2, sets, activeSetIndex };
      
      localStorage.setItem(`live_score_${match.id}`, JSON.stringify(data));
    }
  }, [score1, score2, winnerRank1, winnerRank2, participantScores, sets, activeSetIndex, match, open, is17an]);





  const updateTeam1Score = (delta: number) => {
    isDirty.current = true;
    setSets(prev => prev.map((s, idx) => {
      if (idx === activeSetIndex) {
        return { ...s, team1_score: Math.max(0, s.team1_score + delta) };
      }
      return s;
    }));
  };

  const updateTeam2Score = (delta: number) => {
    isDirty.current = true;
    setSets(prev => prev.map((s, idx) => {
      if (idx === activeSetIndex) {
        return { ...s, team2_score: Math.max(0, s.team2_score + delta) };
      }
      return s;
    }));
  };

  // Refresh match data from DB after a successful save
  const fetchAndSyncMatch = async () => {
    if (!match) return;
    const { data, error } = await supabase
      .from('competition_matches')
      .select('*')
      .eq('id', match.id)
      .single();
    if (error) {
      console.error('Failed to refetch match:', error);
      return;
    }
    // Cast the raw data to the expected type; status is a string that matches MatchStatus
    const fresh = data as unknown as CompetitionMatchWithTeams;
    // Optionally ensure status is a valid MatchStatus
    syncFromDb(fresh);
  };

  const handleUpdateProgress = () => {
    if (!match) return;

    const setsWon1 = sets.filter(s => s.team1_score > s.team2_score).length;
    const setsWon2 = sets.filter(s => s.team2_score > s.team1_score).length;

    const participantScoresToSave = is17an
      ? participantScores.map(ps => {
          const participant = match.participants?.find(p => p.id === ps.id);
          return {
            id: ps.id,
            team_id: participant?.team_id,
            score: ps.score.toString(),
            is_winner: ps.isWinner || (ps.winner_rank === 1),
            winner_rank: ps.winner_rank
          };
        })
      : match.participants?.map(p => {
          const isTeam1 = p.team_id === match.team1_id;
          const scoreVal = isTeam1 ? setsWon1 : setsWon2;
          return {
            id: p.id,
            team_id: p.team_id,
            score: scoreVal.toString(),
            is_winner: false,
            winner_rank: null
          };
        });

    const mutationData = {
      id: match.id,
      competition_id: competition.id,
      status: "ongoing" as const,
      participant_scores: participantScoresToSave,
      score1: !is17an ? setsWon1.toString() : undefined,
      score2: !is17an ? setsWon2.toString() : undefined,
      sets_data: !is17an ? sets : undefined,
    };

    updateMutation.mutate(mutationData, {
      onSuccess: () => {
        // After saving, reset dirty flag so remote updates from other users are accepted again
        isDirty.current = false;
        toast({
          title: "Tersimpan",
          description: "Skor sementara berhasil disimpan.",
        });
      },
    });
  };

  const handleFinishMatch = () => {
    if (!match) return;

    const setsWon1 = sets.filter(s => s.team1_score > s.team2_score).length;
    const setsWon2 = sets.filter(s => s.team2_score > s.team1_score).length;

    let winnerId: string | null = null;
    if (!is17an) {
      if (setsWon1 > setsWon2) winnerId = match.team1_id;
      else if (setsWon2 > setsWon1) winnerId = match.team2_id;
    }

    const participantScoresToSave = is17an
      ? participantScores.map(ps => {
          const participant = match.participants?.find(p => p.id === ps.id);
          return {
            id: ps.id,
            team_id: participant?.team_id,
            score: ps.score.toString(),
            is_winner: ps.isWinner,
            winner_rank: ps.winner_rank
          };
        })
      : match.participants?.map(p => {
          const isTeam1 = p.team_id === match.team1_id;
          const scoreVal = isTeam1 ? setsWon1 : setsWon2;
          const isWinnerVal = isTeam1 ? winnerId === match.team1_id : winnerId === match.team2_id;
          const rankVal = isTeam1
            ? (winnerId === match.team1_id ? 1 : 2)
            : (winnerId === match.team2_id ? 1 : 2);
          return {
            id: p.id,
            team_id: p.team_id,
            score: scoreVal.toString(),
            is_winner: isWinnerVal,
            winner_rank: rankVal
          };
        });

    const mutationData = {
      id: match.id,
      competition_id: competition.id,
      status: "completed" as const,
      participant_scores: participantScoresToSave,
      score1: !is17an ? setsWon1.toString() : undefined,
      score2: !is17an ? setsWon2.toString() : undefined,
      winner_id: winnerId,
      sets_data: !is17an ? sets : undefined,
    };

    updateMutation.mutate(mutationData, {
      onSuccess: () => {
        localStorage.removeItem(`live_score_${match.id}`);
        
        // Play victory sounds (Sports Whistle + User's Clapping Asset)
        const whistle = new Audio("https://assets.mixkit.co/active_storage/sfx/2014/2014-preview.mp3");
        const clapping = new Audio("/sound/clapping.wav");
        
        whistle.volume = 0.6;
        clapping.volume = 0.7;

        whistle.play().catch(err => console.log("Whistle play failed:", err));
        
        setTimeout(() => {
          clapping.play().catch(err => console.log("Clapping play failed:", err));
        }, 200);

        // Celebrate completion immediately
        if (is17an) {
          const hasWinner = participantScores.some(p => p.isWinner || p.winner_rank === 1);
          if (hasWinner) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        } else {
          if (winnerId === match.team1_id) {
            // Team 1 wins: burst from left and then a main center burst
            confetti({
              particleCount: 80,
              angle: 60,
              spread: 80,
              origin: { x: 0, y: 0.8 }
            });
            setTimeout(() => {
              confetti({
                particleCount: 50,
                spread: 90,
                origin: { y: 0.6 }
              });
            }, 200);
          } else if (winnerId === match.team2_id) {
            // Team 2 wins: burst from right and then a main center burst
            confetti({
              particleCount: 80,
              angle: 120,
              spread: 80,
              origin: { x: 1, y: 0.8 }
            });
            setTimeout(() => {
              confetti({
                particleCount: 50,
                spread: 90,
                origin: { y: 0.6 }
              });
            }, 200);
          } else {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }
        }

        onOpenChange(false);
        toast({
          title: is17an ? "Sesi Selesai" : "Pertandingan Selesai",
          description: "Hasil akhir berhasil disimpan.",
        });
      },
    });
  };

  const updateParticipantScore = (id: string, delta: number) => {
    isDirty.current = true;
    setParticipantScores(prev => prev.map(p => 
      p.id === id ? { ...p, score: Math.max(0, p.score + delta) } : p
    ));
  };

  const toggleParticipantWinner = (id: string) => {
    isDirty.current = true;
    setParticipantScores(prev => prev.map(p => 
      p.id === id ? { ...p, isWinner: !p.isWinner, winner_rank: !p.isWinner ? p.winner_rank : null } : p
    ));
  };

  const setParticipantRank = (id: string, rank: number | null) => {
    isDirty.current = true;
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
        <DialogHeader className="shrink-0 p-6 pb-3 relative border-b">
          <DialogTitle className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center text-lg sm:text-xl font-bold leading-tight">
            <span>{readOnly ? "Detail Pertandingan" : (is17an ? "Pencatatan Hasil Sesi" : "Live Score Pertandingan")}</span>
            {match.phase_label && (
              <Badge variant="secondary" className="font-semibold text-xs py-0.5 px-2.5 whitespace-nowrap bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {match.phase_label}
              </Badge>
            )}
          </DialogTitle>
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-muted-foreground text-xs sm:text-sm px-4 mt-1">
            <span className="font-semibold text-foreground/80">{competition.sport_name}</span>
            <span className="text-muted-foreground/30 hidden xs:inline">•</span>
            <span className="text-muted-foreground/80">
              {is17an ? `Sesi ${match.match_number}` : `Babak ${match.round_number} (Match ${match.match_number})`}
            </span>
            {match.group_name && (
              <>
                <span className="text-muted-foreground/30 hidden xs:inline">•</span>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider h-5 px-2 border-primary/30 text-primary bg-primary/5 whitespace-nowrap">
                  Grup {match.group_name}
                </Badge>
              </>
            )}
          </p>
          {canManage && (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-dashed w-full">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold hover:bg-muted"
                onClick={handleEditGame}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Pertandingan</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-200"
                onClick={handleCancelGame}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Batalkan / Reset</span>
              </Button>
            </div>
          )}
        </DialogHeader>



        <div className="flex-1 overflow-auto px-6 py-2">
          {is17an ? (
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
                                {(participant.team as CompetitionTeamWithMembers).members!.map((m) => {
                                  const parsed = parseMemberName(m.name);
                                  const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                  const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                                  return (
                                    <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                                      {name}{house ? ` (${house.block}.${house.number})` : ""}
                                    </Badge>
                                  );
                                })}
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

                         {!readOnly && match.is_final && (
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
            <div className="py-6 sm:py-10 flex flex-col items-center gap-6">
              {/* Set Navigation Tabs */}
              <div className="flex flex-col items-center gap-2 border rounded-2xl p-4 w-full bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Set Aktif:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sets.map((_, idx) => (
                      <Button
                        key={idx}
                        variant={idx === activeSetIndex ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-16 text-xs font-bold"
                        onClick={() => setActiveSetIndex(idx)}
                      >
                        Set {idx + 1}
                      </Button>
                    ))}
                    {!readOnly && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-[10px] px-2 font-bold uppercase tracking-wider"
                          onClick={() => {
                            setSets(prev => [...prev, { team1_score: 0, team2_score: 0 }]);
                            setActiveSetIndex(sets.length);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Set baru
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8 gap-1 text-[10px] px-2.5 font-bold uppercase tracking-wider bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20"
                          onClick={() => {
                            if (window.confirm(`Reset skor Set ${activeSetIndex + 1} menjadi 0 - 0?`)) {
                              setSets(prev => prev.map((s, idx) => idx === activeSetIndex ? { team1_score: 0, team2_score: 0 } : s));
                              isDirty.current = true;
                            }
                          }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset Set
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-center justify-between w-full gap-2 sm:gap-8">
                {/* Team 1: Score on the left */}
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <h3 className="font-bold text-xs sm:text-xl text-center line-clamp-1 mb-1 flex items-center gap-1.5 justify-center">
                    {match.team1 && <TeamFlag team={match.team1} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />}
                    <span>{match.team1 ? extractFlagAndName(match.team1.name).name : "TBD"}</span>
                  </h3>

                  {/* Players List Team 1 */}
                  {(match.team1 as CompetitionTeamWithMembers)?.members && (match.team1 as CompetitionTeamWithMembers).members!.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-3 max-w-[200px]">
                      {(match.team1 as CompetitionTeamWithMembers).members!.map((m) => {
                        const parsed = parseMemberName(m.name);
                        const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                        const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                        return (
                          <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                            {name}{house ? ` (${house.block}.${house.number})` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted w-24 h-24 sm:w-[180px] sm:h-24 rounded-xl sm:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
                      <span className="text-5xl sm:text-6xl font-black tracking-tighter z-10">
                        {sets[activeSetIndex]?.team1_score ?? 0}
                      </span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0" onClick={() => updateTeam1Score(-1)}>
                          <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                        <Button variant="default" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0 shadow-md" onClick={() => updateTeam1Score(1)}>
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Rank Selection Team 1 */}
                    {!readOnly && match.is_final && (
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

                <div className="flex flex-col items-center gap-4 px-2 sm:px-4 shrink-0">
                  <div className="text-xl sm:text-3xl font-black text-muted-foreground/20 italic">VS</div>
                  
                  {/* Sets / Games interactive indicator list */}
                  <div className="flex flex-col items-center gap-2 border border-border/60 bg-muted/20 rounded-2xl p-3 shrink-0 select-none">
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      {Math.max(sets.length, 3)} Game
                    </div>
                    <div className="flex flex-col gap-2">
                      {Array.from({ length: Math.max(sets.length, 3) }).map((_, idx) => {
                        const set = sets[idx];
                        const isPlayed = !!set && (set.team1_score > 0 || set.team2_score > 0);
                        const team1Won = isPlayed && set.team1_score > set.team2_score;
                        const team2Won = isPlayed && set.team2_score > set.team1_score;
                        
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            {/* Team 1 Circle */}
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => handleCircleClick(idx, 1)}
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm",
                                team1Won
                                  ? "bg-emerald-500 border-emerald-600 text-white font-bold"
                                  : isPlayed && team2Won
                                  ? "bg-rose-500 border-rose-600 text-white font-bold"
                                  : "bg-muted border-border hover:border-primary/50 text-muted-foreground"
                              )}
                              title={team1Won ? "Tim 1 Menang" : team2Won ? "Tim 1 Kalah" : "Klik untuk atur set"}
                            >
                              {team1Won ? "✓" : team2Won ? "✗" : ""}
                            </button>
                            
                            <span className="text-[10px] font-bold text-muted-foreground/80 min-w-[32px] text-center">
                              G{idx + 1}
                            </span>
                            
                            {/* Team 2 Circle */}
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => handleCircleClick(idx, 2)}
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shadow-sm",
                                team2Won
                                  ? "bg-emerald-500 border-emerald-600 text-white font-bold"
                                  : isPlayed && team1Won
                                  ? "bg-rose-500 border-rose-600 text-white font-bold"
                                  : "bg-muted border-border hover:border-primary/50 text-muted-foreground"
                              )}
                              title={team2Won ? "Tim 2 Menang" : team1Won ? "Tim 2 Kalah" : "Klik untuk atur set"}
                            >
                              {team2Won ? "✓" : team1Won ? "✗" : ""}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Team 2: Score on the right */}
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <h3 className="font-bold text-xs sm:text-xl text-center line-clamp-1 mb-1 flex items-center gap-1.5 justify-center">
                    {match.team2 && <TeamFlag team={match.team2} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />}
                    <span>{match.team2 ? extractFlagAndName(match.team2.name).name : "TBD"}</span>
                  </h3>
                  {/* Players List Team 2 */}
                  {(match.team2 as CompetitionTeamWithMembers)?.members && (match.team2 as CompetitionTeamWithMembers).members!.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 mb-3 max-w-[200px]">
                      {(match.team2 as CompetitionTeamWithMembers).members!.map((m) => {
                        const parsed = parseMemberName(m.name);
                        const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                        const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                        return (
                          <Badge key={m.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal bg-muted/50 text-muted-foreground border-none">
                            {name}{house ? ` (${house.block}.${house.number})` : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-muted w-24 h-24 sm:w-[180px] sm:h-24 rounded-xl sm:rounded-3xl flex items-center justify-center relative overflow-hidden border-2 border-transparent transition-all duration-500 shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
                      <span className="text-5xl sm:text-6xl font-black tracking-tighter z-10">
                        {sets[activeSetIndex]?.team2_score ?? 0}
                      </span>
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0" onClick={() => updateTeam2Score(-1)}>
                          <Minus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                        <Button variant="default" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl shrink-0 shadow-md" onClick={() => updateTeam2Score(1)}>
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                      </div>
                    )}
                    {/* Rank Selection Team 2 */}
                    {!readOnly && match.is_final && (
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

              {/* Set Win Summary Footer */}
              <div className="flex items-center justify-center w-full border-t border-dashed pt-4 text-xs font-semibold">
                <span className="font-mono text-lg bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1 text-primary">
                  {sets.filter(s => s.team1_score > s.team2_score).length} - {sets.filter(s => s.team2_score > s.team1_score).length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Tampilkan Pemenang Button */}
        {match.status === "completed" && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-24 right-6 z-50 pointer-events-auto"
          >
            <Button
              onClick={() => setIsWinnerAnnounceOpen(true)}
              className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-black shadow-xl shadow-yellow-500/30 rounded-full border border-yellow-400/50 flex items-center gap-2 py-3 px-6 h-auto text-sm animate-bounce"
            >
              <Trophy className="w-5 h-5 fill-white" />
              Tampilkan Pemenang
            </Button>
          </motion.div>
        )}

        <DialogFooter className="flex flex-col gap-4 p-6 pt-3 shrink-0 bg-muted/5 border-t w-full">
          {/* Auto Refresh Row */}
          {match.status === "ongoing" && (
            <div className="flex items-center justify-between gap-4 w-full bg-muted/30 border border-border/60 rounded-xl p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <RefreshCw className={`w-4 h-4 ${isFetching && autoRefresh ? 'animate-spin' : ''}`} />
                </div>
                <div className="text-left min-w-0">
                  <Label htmlFor="live-auto-refresh" className="text-xs font-bold block cursor-pointer">Auto Refresh (10s)</Label>
                  <span className="text-[10px] text-muted-foreground block truncate">Sinkronisasi skor otomatis secara berkala</span>
                </div>
              </div>
              <Switch
                id="live-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={(checked) => {
                  setAutoRefresh(checked);
                  if (checked) {
                    refetch();
                  }
                }}
              />
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-end">
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
          </div>
        </DialogFooter>
      </DialogContent>
      <WinnerAnnounceDialog
        open={isWinnerAnnounceOpen}
        onOpenChange={setIsWinnerAnnounceOpen}
        competition={competition}
        match={match}
      />
    </Dialog>
  );
}
