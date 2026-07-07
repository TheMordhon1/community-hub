import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Clock, MapPin, Radio, Calendar, Users, Eye, CheckCircle2, ArrowLeft, X, GitBranch, Play, RefreshCw, MessageSquare, Copy, Send, ExternalLink } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { id } from "date-fns/locale";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import LiveScoreDialog from "@/components/competitions/LiveScoreDialog";
import { UpdateMatchDialog } from "@/components/competitions/UpdateMatchDialog";
import { AssignRefereeDialog } from "@/components/competitions/AssignRefereeDialog";
import { useAuth } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GroupStandings } from "@/components/competitions/GroupStandings";
import { getTeamFlag, extractFlagAndName } from "@/lib/countries";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { TournamentBracket } from "@/components/competitions/TournamentBracket";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails } from "@/types/competition";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn, parseMemberName, capitalizeName } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface MatchTeam {
  id: string;
  name: string;
  logo_url?: string | null;
  members?: { id: string, name: string | null, user_id?: string | null, profile?: { full_name?: string | null, avatar_url?: string | null, house?: { block: string; number: string } } }[];
}

interface MatchParticipant {
  id: string;
  team_id: string | null;
  score: string | null;
  is_winner: boolean | null;
  winner_rank: number | null;
  team: MatchTeam | null;
}

interface CompetitionDetail {
  id: string;
  sport_name: string;
  custom_match_label: string | null;
  format: string;
  sets_per_match: number | null;
  referees?: { user_id: string }[] | null;
}

interface MatchSetData {
  team1_score: number;
  team2_score: number;
}

interface MatchData {
  id: string;
  competition_id: string;
  round_number: number;
  match_number: number;
  team1_id: string | null;
  team2_id: string | null;
  score1: string | null;
  score2: string | null;
  winner_id: string | null;
  status: string;
  match_datetime: string | null;
  location: string | null;
  sets_data?: MatchSetData[] | null;
  group_name: string | null;
  phase_label: string | null;
  is_final: boolean | null;
  stage: string | null;
  competition: CompetitionDetail | null;
  team1: MatchTeam | null;
  team2: MatchTeam | null;
  participants: MatchParticipant[];
}



export default function LiveMatches() {
  const queryClient = useQueryClient();
  const { user, isAdmin, pengurusTitle } = useAuth();

  const isMenteriSistemDigital = pengurusTitle === "menteri_sisdigi";
  const canManageMatch = (match: MatchData) => {
    if (!user) return false;
    const isRefereeOfMatch = match?.competition?.referees?.some(
      (ref) => ref.user_id === user.id
    );
    return isAdmin() || isMenteriSistemDigital || !!isRefereeOfMatch;
  };
  const [searchParams, setSearchParams] = useSearchParams();

  const VALID_TABS = ["live", "upcoming", "completed", "standings", "chart"] as const;
  type TabValue = typeof VALID_TABS[number];
  const rawTab = searchParams.get("tab");
  const activeTab: TabValue = VALID_TABS.includes(rawTab as TabValue)
    ? (rawTab as TabValue)
    : "live";

  const setActiveTab = (tab: TabValue) => {
    setSearchParams({ tab }, { replace: true });
  };

  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingStartMatchId, setPendingStartMatchId] = useState<string | null>(null);
  const [openMemberPopover, setOpenMemberPopover] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("all");
  const [selectedPhase, setSelectedPhase] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { toast } = useToast();
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [selectedBroadcastMatchIds, setSelectedBroadcastMatchIds] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");

  const getSportEmojiString = (sportName: string | undefined): string => {
    if (!sportName) return "🏆";
    const type = sportName.toLowerCase();
    if (type.includes("badminton") || type.includes("bulutangkis")) return "🏸";
    if (type.includes("bola") || type.includes("futsal") || type.includes("sepak")) return "⚽";
    if (type.includes("voli")) return "🏐";
    if (type.includes("tenis") || type.includes("pingpong")) return "🏓";
    if (type.includes("catur")) return "♟️";
    if (type.includes("mobile") || type.includes("game") || type.includes("esport")) return "🎮";
    return "🏆";
  };

  const generateWhatsAppMessageForMatches = (matchIds: string[]) => {
    if (matchIds.length === 0) {
      return "📢 *INFORMASI PERTANDINGAN* 📢\n\n(Belum ada pertandingan yang dipilih)";
    }
    
    const selectedMatches = filteredMatches.filter(m => matchIds.includes(m.id));
    
    // Determine header based on statuses
    const statuses = selectedMatches.map(m => m.status);
    const hasLive = statuses.includes("ongoing");
    const hasCompleted = statuses.includes("completed");
    const hasScheduled = statuses.includes("scheduled");
    
    let header = "📢 *INFORMASI PERTANDINGAN* 📢";
    let intro = "Berikut adalah informasi terkini mengenai pertandingan Warga PKT:";
    
    if (hasLive && !hasCompleted && !hasScheduled) {
      header = "🔥 *PERTANDINGAN SEDANG BERLANGSUNG (LIVE)* 🔥";
      intro = "Ayo dukung dan saksikan tim favoritmu bertanding sekarang! Jangan sampai ketinggalan keseruannya! 🔴🎥";
    } else if (hasCompleted && !hasLive && !hasScheduled) {
      header = "🏆 *HASIL PERTANDINGAN TERBARU* 🏆";
      intro = "Selamat kepada para pemenang! Berikut adalah hasil pertandingan terbaru:";
    } else if (hasScheduled && !hasLive && !hasCompleted) {
      header = "📢 *JADWAL PERTANDINGAN MENDATANG* 📢";
      intro = "Berikut adalah jadwal pertandingan mendatang yang akan segera berlangsung. Jangan lewatkan dan berikan dukunganmu! 🔥🎉";
    }
    
    let message = `${header}\n\n${intro}\n\n`;
    
    selectedMatches.forEach((match, index) => {
      const is17an = match.competition?.format === "17an";
      const title = match.competition?.custom_match_label || match.competition?.sport_name || "Pertandingan";
      const phase = match.phase_label || "Group Stage";
      const group = match.group_name ? ` (Grup ${match.group_name})` : "";
      const timeFormatted = formatMatchTime(match.match_datetime);
      const location = match.location ? `\n📍 *Lokasi:* ${match.location}` : "";
      const sportEmoji = getSportEmojiString(match.competition?.sport_name);
      
      let detailsText = "";
      let scoreText = "";
      
      // Calculate sets/scores for formatting
      const setsWon1 = Array.isArray(match.sets_data) 
        ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length 
        : 0;
      const setsWon2 = Array.isArray(match.sets_data) 
        ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length 
        : 0;
        
      if (is17an) {
        detailsText = `🏁 *Detail:* Pertandingan Individual (17an)`;
        if (match.status === "completed") {
          detailsText += `\n🏆 Status: Selesai`;
        } else if (match.status === "ongoing") {
          detailsText += `\n🔴 Status: Sedang Berlangsung`;
        }
      } else {
        const team1Name = match.team1 ? extractFlagAndName(match.team1.name).name : "Tim 1";
        const team2Name = match.team2 ? extractFlagAndName(match.team2.name).name : "Tim 2";
        
        if (match.status === "completed") {
          const winnerText = setsWon1 > setsWon2 
            ? `🏆 Pemenang: *${team1Name}*` 
            : setsWon2 > setsWon1 
              ? `🏆 Pemenang: *${team2Name}*` 
              : `🤝 Hasil: Seri`;
          detailsText = `⚔️ *Pertandingan:* *${team1Name}* VS *${team2Name}*\n${winnerText}`;
          scoreText = `\n📊 *Skor Akhir:* *${setsWon1}* - *${setsWon2}*`;
          if (match.sets_data && match.sets_data.length > 0) {
            const setsScores = match.sets_data.map(s => `${s.team1_score}-${s.team2_score}`).join(", ");
            scoreText += ` (${setsScores})`;
          }
        } else if (match.status === "ongoing") {
          detailsText = `⚔️ *Pertandingan:* *${team1Name}* VS *${team2Name}*\n🔴 *Status:* Sedang Berlangsung (LIVE)`;
          scoreText = `\n📊 *Skor Sementara:* *${setsWon1}* - *${setsWon2}*`;
          if (match.sets_data && match.sets_data.length > 0) {
            const setsScores = match.sets_data.map(s => `${s.team1_score}-${s.team2_score}`).join(", ");
            scoreText += ` (${setsScores})`;
          }
        } else {
          detailsText = `⚔️ *Pertandingan:* *${team1Name}* VS *${team2Name}*`;
        }
        
        const team1Members = match.team1?.members?.map(m => {
          const parsed = parseMemberName(m.name);
          const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
          const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
          return house ? `${name} (${house.block}.${house.number})` : name;
        }).join(", ");
        
        const team2Members = match.team2?.members?.map(m => {
          const parsed = parseMemberName(m.name);
          const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
          const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
          return house ? `${name} (${house.block}.${house.number})` : name;
        }).join(", ");
        
        if (team1Members || team2Members) {
          detailsText += `\n👥 *Anggota Tim:*`;
          if (team1Members) detailsText += `\n• *${team1Name}:* ${team1Members}`;
          if (team2Members) detailsText += `\n• *${team2Name}:* ${team2Members}`;
        }
      }
      
      message += `${sportEmoji} *${title}* (${phase}${group})\n${detailsText}${scoreText}\n📅 *Jadwal:* ${timeFormatted}${location}\n`;
      
      if (index < selectedMatches.length - 1) {
        message += `\n------------------\n\n`;
      }
    });
    
    const liveLink = `${window.location.origin}/live-matches`;
    message += `\n\n🔗 *Pantau skor langsung semua pertandingan di:* ${liveLink}`;
    
    return message;
  };

  useEffect(() => {
    if (isBroadcastOpen) {
      setBroadcastMessage(generateWhatsAppMessageForMatches(selectedBroadcastMatchIds));
    } else {
      setBroadcastMessage("");
    }
  }, [selectedBroadcastMatchIds, isBroadcastOpen]);

  const startMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase
        .from("competition_matches")
        .update({ status: "ongoing" })
        .eq("id", matchId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-matches"] });
    },
  });

  // Close member popover on any click outside
  useEffect(() => {
    if (!openMemberPopover) return;
    const handler = () => setOpenMemberPopover(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMemberPopover]);

  // Fetch matches (ongoing, scheduled, and completed)
  const { data: matches = [], isLoading, error, refetch, isFetching } = useQuery<MatchData[]>({
    queryKey: ["live-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competition_matches")
        .select(`
          *,
          competition:event_competitions (
            id,
            sport_name,
            custom_match_label,
            format,
            sets_per_match,
            kids_brackets,
            advance_per_group,
            referees:competition_referees(user_id)
          ),
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
        .in("status", ["ongoing", "scheduled", "completed"])
        .order("match_datetime", { ascending: true });

      if (error) throw error;
      
      const rawMatches = (data || []) as unknown as MatchData[];
      const userIds = new Set<string>();
      
      rawMatches.forEach((m) => {
        m.team1?.members?.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
        m.team2?.members?.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
        m.participants?.forEach((p) => {
          p.team?.members?.forEach((mem) => { if (mem.user_id) userIds.add(mem.user_id); });
        });
      });

      let profileMap = new Map<string, { id: string, full_name: string | null, avatar_url?: string | null, house?: { block: string; number: string } }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", Array.from(userIds));
        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Fetch house for each registered member (two-step: residents → houses)
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

      const attachProfile = (team: MatchTeam | null) => {
        if (!team || !team.members) return;
        team.members = team.members.map((mem) => {
          if (mem.user_id) {
            return { ...mem, profile: profileMap.get(mem.user_id) };
          }
          // Manual member: build profile-like object from stored house_block/house_number
          const manualMem = mem as typeof mem & { house_block?: string | null; house_number?: string | null };
          const manualHouse =
            manualMem.house_block && manualMem.house_number
              ? { block: manualMem.house_block, number: manualMem.house_number }
              : undefined;
          return {
            ...mem,
            profile: manualHouse ? { house: manualHouse } : undefined,
          };
        });
      };

      rawMatches.forEach((m) => {
        attachProfile(m.team1);
        attachProfile(m.team2);
        m.participants?.forEach((p) => attachProfile(p.team));
      });

      return rawMatches as unknown as MatchData[];
    },
    refetchInterval: (query) => {
      if (autoRefresh) return 10000;
      const hasOngoing = query.state?.data?.some((m) => m.status === "ongoing");
      return hasOngoing ? 10000 : 30000; // Refetch every 10s if ongoing, else 30s
    },
  });

  // Sync selectedMatch with fresh data from refetch so dialog always shows latest score
  useEffect(() => {
    if (dialogOpen && selectedMatch && matches.length > 0) {
      const freshMatch = matches.find((m) => m.id === selectedMatch.id);
      if (freshMatch) {
        setSelectedMatch(freshMatch);
      }
    }
  }, [matches]);

  const compIds = Array.from(new Set(matches.map(m => m.competition_id)));
  const { data: allTeams = [] } = useQuery({
    queryKey: ["live-teams", compIds],
    queryFn: async () => {
      if (compIds.length === 0) return [];
      const { data, error } = await supabase
        .from("competition_teams")
        .select(`
          id, name, group_name, competition_id, logo_url,
          members:competition_team_members(id, name, user_id, house_block, house_number)
        `)
        .in("competition_id", compIds)
        .not("group_name", "is", null);
        
      if (error) throw error;

      type RawTeamMember = { id: string; name: string | null; user_id: string | null; house_block: string | null; house_number: string | null };
      type RawTeam = { id: string; name: string; group_name: string | null; competition_id: string; logo_url?: string | null; members: RawTeamMember[] | null };
      const teams = (data as unknown as RawTeam[]) || [];

      const userIds = new Set<string>();
      teams.forEach((t) => t.members?.forEach((m) => { if (m.user_id) userIds.add(m.user_id); }));
      
      let profileMap = new Map<string, { id: string, full_name: string | null, house?: { block: string; number: string } }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIds));
        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

        // Fetch house for each registered member
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
      
      return teams.map(t => ({
        ...t,
        members: t.members?.map((m) => {
          if (m.user_id) {
            return { ...m, profile: profileMap.get(m.user_id) };
          }
          const manualHouse = m.house_block && m.house_number
            ? { block: m.house_block, number: m.house_number }
            : undefined;
          return {
            ...m,
            profile: manualHouse ? { house: manualHouse } : undefined,
          };
        })
      })) as (MatchTeam & { competition_id: string })[];
    },
    enabled: compIds.length > 0
  });

  const uniqueCompetitions = Array.from(
    new Map(
      matches
        .map((m) => m.competition)
        .filter((c): c is CompetitionDetail => !!c)
        .map((c) => [c.id, c])
    ).values()
  );

  const uniquePhases = Array.from(
    new Set(
      matches.map((m) => m.phase_label || (m.stage === "group" ? "Group Stage" : "Penyisihan"))
    )
  ).filter(Boolean) as string[];

  const filteredMatches = matches.filter((match) => {
    // 1. Filter by search query (team name or member name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().replace(/\s+/g, "");
      const clean = (str: string | null | undefined) => 
        str ? str.toLowerCase().replace(/\s+/g, "") : "";

      const matchesTeam = 
        clean(match.team1?.name).includes(q) ||
        clean(match.team2?.name).includes(q) ||
        match.participants?.some(p => clean(p.team?.name).includes(q));
      
      const matchesMember = 
        match.team1?.members?.some(m => 
          clean(parseMemberName(m.name).name).includes(q) || 
          clean(m.profile?.full_name).includes(q)
        ) ||
        match.team2?.members?.some(m => 
          clean(parseMemberName(m.name).name).includes(q) || 
          clean(m.profile?.full_name).includes(q)
        ) ||
        match.participants?.some(p => 
          p.team?.members?.some(m => 
            clean(parseMemberName(m.name).name).includes(q) || 
            clean(m.profile?.full_name).includes(q)
          )
        );

      if (!matchesTeam && !matchesMember) {
        return false;
      }
    }

    // 2. Filter by date
    if (selectedDate) {
      if (!match.match_datetime) return false;
      const matchDate = new Date(match.match_datetime);
      const isSameDay = 
        matchDate.getDate() === selectedDate.getDate() &&
        matchDate.getMonth() === selectedDate.getMonth() &&
        matchDate.getFullYear() === selectedDate.getFullYear();
      if (!isSameDay) return false;
    }

    // 3. Filter by competition id
    if (selectedCompetitionId !== "all") {
      if (match.competition_id !== selectedCompetitionId) {
        return false;
      }
    }

    // 4. Filter by phase
    if (selectedPhase !== "all") {
      const matchPhase = match.phase_label || (match.stage === "group" ? "Group Stage" : "Penyisihan");
      if (matchPhase !== selectedPhase) {
        return false;
      }
    }

    return true;
  });

  // Sort filtered matches by latest match (descending: latest first, nulls last)
  filteredMatches.sort((a, b) => {
    if (!a.match_datetime && b.match_datetime) return 1;
    if (a.match_datetime && !b.match_datetime) return -1;
    if (!a.match_datetime && !b.match_datetime) return 0;
    return new Date(b.match_datetime).getTime() - new Date(a.match_datetime).getTime();
  });

  const ongoingMatches = filteredMatches.filter((m) => m.status === "ongoing");
  const upcomingMatches = filteredMatches.filter((m) => m.status === "scheduled");
  const completedMatches = filteredMatches.filter((m) => m.status === "completed");

  const formatMatchTime = (datetimeStr: string | null) => {
    if (!datetimeStr) return "Waktu belum diatur";
    const date = parseISO(datetimeStr);
    const timeStr = format(date, "HH:mm");
    
    if (isToday(date)) {
      return `Hari ini, ${timeStr}`;
    }
    if (isTomorrow(date)) {
      return `Besok, ${timeStr}`;
    }
    return format(date, "EEEE, d MMMM yyyy - HH:mm", { locale: id });
  };

  const renderTeamName = (team: MatchTeam | null, defaultName: string, matchId?: string) => {
    if (!team) return <span className="truncate max-w-full inline-block align-bottom">{defaultName}</span>;
    
    const { name: cleanName } = extractFlagAndName(team.name);
    
    if (team.members && team.members.length > 0) {
      const popoverId = matchId ? `${matchId}_${team.id}` : team.id;
      const isPopoverOpen = openMemberPopover === popoverId;
      return (
        <span className="inline-flex items-center gap-1.5 max-w-full truncate align-bottom">
          <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
          <Popover open={isPopoverOpen} onOpenChange={(open) => setOpenMemberPopover(open ? popoverId : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="cursor-pointer inline-flex items-center gap-1 hover:text-primary transition-colors max-w-full font-bold text-xs truncate focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <span className="truncate">{cleanName}</span>
                <Users className="w-3.5 h-3.5 shrink-0 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-56 p-3 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl z-50"
              side="top"
              align="center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-bold text-foreground mb-1.5">Anggota Tim:</div>
              <ul className="text-xs space-y-1.5">
                {team.members.map(m => {
                  const parsed = parseMemberName(m.name);
                  const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                  const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
                  return (
                    <li key={m.id} className="flex items-center gap-2 text-muted-foreground truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">
                        {name}{house ? ` (${house.block}.${house.number})` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1.5 max-w-full truncate align-bottom">
        <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
        <span className="truncate">{cleanName}</span>
      </span>
    );
  };

  const getSportEmoji = (sportName: string | undefined) => {
    if (!sportName) return "🏆";
    const type = sportName.toLowerCase();
    if (type.includes("badminton") || type.includes("bulutangkis")) return "🏸";
    if (type.includes("bola") || type.includes("futsal") || type.includes("sepak")) return "⚽";
    if (type.includes("voli")) return "🏐";
    if (type.includes("tenis") || type.includes("pingpong")) return "🏓";
    if (type.includes("catur")) return "♟️";
    if (type.includes("mobile") || type.includes("game") || type.includes("esport")) return "🎮";
    return "🏆";
  };

  const renderMatchCard = (match: MatchData) => {
    const is17an = match.competition?.format === "17an";
    const setsWon1 = Array.isArray(match.sets_data) 
      ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length 
      : 0;
    const setsWon2 = Array.isArray(match.sets_data) 
      ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length 
      : 0;

    return (
      <Card 
        key={match.id} 
        className={cn(
          "overflow-hidden transition-all duration-300 shadow-md hover:shadow-lg flex flex-col cursor-pointer bg-card/60 backdrop-blur border",
          match.status === "ongoing" ? "border-primary/40" : "border-border/60 hover:border-primary/20"
        )}
        onClick={() => {
          setSelectedMatch(match);
          setDialogOpen(true);
        }}
      >
        <div className="bg-muted/40 px-3 py-1.5 border-b border-border/60 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm">{getSportEmoji(match.competition?.sport_name)}</span>
            <span className="font-semibold text-muted-foreground truncate max-w-[150px]">
              {match.competition?.custom_match_label || match.competition?.sport_name}
            </span>
            {canManageMatch(match) && match.competition_id && (
              <Link
                to={`/competitions/${match.competition_id}`}
                onClick={(e) => e.stopPropagation()}
                className="ml-1 p-0.5 rounded text-primary hover:bg-muted-foreground/10 transition-colors flex items-center justify-center shrink-0"
                title="Kelola Kompetisi"
              >
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
          {match.status === "ongoing" ? (
            <Badge variant="destructive" className="bg-red-500 animate-pulse text-[9px] font-extrabold uppercase px-1.5 py-0">
              LIVE
            </Badge>
          ) : match.status === "completed" ? (
            <Badge variant="secondary" className="bg-muted-foreground/10 text-[9px] font-bold uppercase px-1.5 py-0">
              Selesai
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] font-bold uppercase px-1.5 py-0">
              Jadwal
            </Badge>
          )}
        </div>

        <CardContent className="p-3 flex-1 flex flex-col justify-between gap-2.5">
          <div className="text-center text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
            {match.phase_label || (match.stage === "group" ? "Group Stage" : "Penyisihan")} {match.group_name ? `• ${match.group_name}` : ""}
          </div>

          {!is17an ? (
            <div className="flex items-center justify-between gap-1 py-1">
              <div className="flex-1 text-center min-w-0">
                <div className={cn("font-bold text-xs truncate", match.status === "completed" && setsWon1 > setsWon2 && "text-primary")}>
                  {renderTeamName(match.team1, "TBD", match.id)}
                </div>
                {match.team1?.members && match.team1.members.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 max-h-[40px] overflow-y-auto scrollbar-none">
                    {match.team1.members.map((m) => {
                      const parsed = parseMemberName(m.name);
                      const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                      const house = (m.profile as unknown as { house: { block: string; number: string } })?.house;
                      return (
                        <li key={m.id} className="text-[9px] text-muted-foreground truncate">
                          {name}{house ? ` (${house.block}.${house.number})` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex flex-col items-center px-2">
                <div className="flex items-center gap-1.5 bg-muted/30 border rounded-lg px-2.5 py-1 font-mono text-base font-bold shadow-inner">
                  <span className={setsWon1 > setsWon2 ? "text-primary" : ""}>{setsWon1}</span>
                  <span className="text-muted-foreground/30">:</span>
                  <span className={setsWon2 > setsWon1 ? "text-primary" : ""}>{setsWon2}</span>
                </div>
              </div>

              <div className="flex-1 text-center min-w-0">
                <div className={cn("font-bold text-xs truncate", match.status === "completed" && setsWon2 > setsWon1 && "text-primary")}>
                  {renderTeamName(match.team2, "TBD", match.id)}
                </div>
                {match.team2?.members && match.team2.members.length > 0 && (
                  <ul className="mt-0.5 space-y-0.5 max-h-[40px] overflow-y-auto scrollbar-none">
                    {match.team2.members.map((m) => {
                      const parsed = parseMemberName(m.name);
                      const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                      const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
                      return (
                        <li key={m.id} className="text-[9px] text-muted-foreground truncate">
                          {name}{house ? ` (${house.block}.${house.number})` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 py-0.5">
              <div className="grid gap-1">
                {match.participants?.slice(0, 2).map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] bg-muted/20 px-2 py-1 rounded border">
                    <span className="truncate font-medium">{p.team?.name || "Peserta"}</span>
                    <span className="font-mono font-bold text-primary">{p.score || "0"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between w-full pt-2 border-t border-dashed text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground/60" />
              {formatMatchTime(match.match_datetime)}
            </span>
            {match.location && (
              <span className="truncate max-w-[100px] flex items-center gap-0.5">
                <MapPin className="w-3 h-3 text-muted-foreground/60" />
                {match.location}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <section className="min-h-screen bg-background p-3 sm:p-6">
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Skor Live & Jadwal</h1>
              </motion.div>
            </div>
            <div className="flex items-center shrink-0">
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  refetch();
                  setAutoRefresh(!autoRefresh);
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span>
                  {autoRefresh ? "Auto: Aktif" : "Refresh"}
                </span>
              </Button>
            </div>
          </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Memuat data pertandingan...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="py-10 flex flex-col items-center justify-center text-center gap-3">
            <Trophy className="w-12 h-12 text-destructive opacity-80" />
            <h3 className="font-bold text-lg text-destructive">Gagal Memuat Data</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Terjadi kesalahan saat memuat data pertandingan live. Silakan coba beberapa saat lagi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-muted/30 p-3 rounded-xl border">
            <div className="relative flex-1 w-full">
              <Input
                placeholder="Cari tim atau anggota..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            <Select
              value={selectedCompetitionId}
              onValueChange={setSelectedCompetitionId}
            >
              <SelectTrigger className="w-full md:w-[200px] bg-background shrink-0">
                <SelectValue placeholder="Pilih Kompetisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kompetisi</SelectItem>
                {uniqueCompetitions.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.custom_match_label || comp.sport_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

             <Select
              value={selectedPhase}
              onValueChange={setSelectedPhase}
            >
              <SelectTrigger className="w-full md:w-[180px] bg-background shrink-0">
                <SelectValue placeholder="Pilih Fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Fase</SelectItem>
                {uniquePhases.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full md:w-[220px] justify-start text-left font-normal bg-background shrink-0",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">
                    {selectedDate ? (
                      format(selectedDate, "dd MMMM yyyy", { locale: id })
                    ) : (
                      <span>Filter tanggal</span>
                    )}
                  </span>
                  {selectedDate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-5 w-5 p-0 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(undefined);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {activeTab === "chart" && (
              <Select
                value={selectedStatus}
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger className="w-full md:w-[180px] bg-background shrink-0">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="upcoming">Akan Datang</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="ongoing">Live / Berlangsung</SelectItem>
                </SelectContent>
              </Select>
            )}

            {(searchQuery || selectedDate || selectedCompetitionId !== "all" || selectedPhase !== "all" || selectedStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDate(undefined);
                  setSelectedCompetitionId("all");
                  setSelectedPhase("all");
                  setSelectedStatus("all");
                }}
                className="h-10 text-muted-foreground hover:text-foreground shrink-0 w-full md:w-auto"
              >
                Reset Filter
              </Button>
            )}
          </div>

          <Tabs defaultValue="live" value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full h-11 p-1 bg-muted/60 border rounded-xl">
            <TabsTrigger value="live" className="rounded-lg gap-1 text-[11px] sm:text-xs font-semibold px-1">
              <Radio className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${ongoingMatches.length > 0 ? "text-red-500 animate-pulse" : ""}`} />
              <span className="hidden xs:inline">Live</span>
              <span className="xs:hidden">Live</span>
              {ongoingMatches.length > 0 && (
                <Badge variant="destructive" className="ml-0.5 px-1 py-0 text-[9px] font-bold">
                  {ongoingMatches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg gap-1 text-[11px] sm:text-xs font-semibold px-1">
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Akan Datang</span>
              <span className="sm:hidden">Datang</span>
              {upcomingMatches.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[9px] font-semibold bg-muted-foreground/10 shrink-0">
                  {upcomingMatches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg gap-1 text-[11px] sm:text-xs font-semibold px-1">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Selesai</span>
              <span className="sm:hidden">Selesai</span>
              {completedMatches.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[9px] font-semibold bg-muted-foreground/10 shrink-0">
                  {completedMatches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="chart" className="rounded-lg gap-1 text-[11px] sm:text-xs font-semibold px-1">
              <GitBranch className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Bagan</span>
              <span className="sm:hidden">Bagan</span>
            </TabsTrigger>
            <TabsTrigger value="standings" className="rounded-lg gap-1 text-[11px] sm:text-xs font-semibold px-1">
              <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Klasemen</span>
              <span className="sm:hidden">Klas.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4">
            {ongoingMatches.length === 0 ? (
              <Card className="border-dashed py-16">
                <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Radio className="w-8 h-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-bold text-lg">Tidak ada pertandingan live</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Saat ini tidak ada pertandingan yang sedang berlangsung. Lihat tab "Akan Datang" untuk jadwal berikutnya.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                {ongoingMatches.map((match) => {
                  const is17an = match.competition?.format === "17an";
                  const setsWon1 = Array.isArray(match.sets_data) 
                    ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length 
                    : 0;
                  const setsWon2 = Array.isArray(match.sets_data) 
                    ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length 
                    : 0;

                  return (
                    <Card 
                      key={match.id} 
                      className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all duration-300 shadow-md hover:shadow-lg flex flex-col cursor-pointer"
                      onClick={() => {
                        setSelectedMatch(match);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="bg-primary/5 px-4 py-2 border-b border-primary/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getSportEmoji(match.competition?.sport_name)}</span>
                          <span className="font-semibold text-foreground/80 truncate max-w-[200px]">
                            {match.competition?.custom_match_label || match.competition?.sport_name}
                          </span>
                        </div>
                        <Badge variant="destructive" className="bg-red-500 animate-pulse text-[10px] font-extrabold uppercase px-2 py-0.5 tracking-wider gap-1">
                          <Radio className="w-2.5 h-2.5" />
                          LIVE
                        </Badge>
                      </div>

                      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 sm:gap-4">
                        <div className="text-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {match.phase_label || "Group Stage"} {match.group_name ? `• ${match.group_name}` : ""}
                        </div>

                        {!is17an ? (
                          <div className="flex items-center justify-between gap-2 py-2">
                            {/* Team 1 */}
                            <div className="flex-1 text-center min-w-0 flex flex-col items-center gap-1">
                              <div className="font-bold text-sm">
                                {renderTeamName(match.team1, "TBD", match.id)}
                              </div>
                              {match.team1?.members && match.team1.members.length > 0 && (
                                <ul className="space-y-0.5 max-h-[50px] overflow-y-auto scrollbar-none w-full flex flex-col items-center">
                                  {match.team1.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
                                    return (
                                      <li key={m.id} className="text-[10px] text-muted-foreground truncate max-w-[90%] flex items-center justify-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                                        <span>{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              {match.sets_data && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Set Won: <span className="font-bold text-primary">{setsWon1}</span>
                                </div>
                              )}
                            </div>

                            {/* Score Display */}
                            <div className="flex flex-col items-center px-4">
                              <div className="flex items-center gap-2 bg-muted/60 border rounded-xl px-4 py-2 font-mono text-2xl font-black tracking-tight shadow-inner">
                                <span className={setsWon1 > setsWon2 ? "text-primary" : ""}>
                                  {setsWon1}
                                </span>
                                <span className="text-muted-foreground/30 text-lg">:</span>
                                <span className={setsWon2 > setsWon1 ? "text-primary" : ""}>
                                  {setsWon2}
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                                Skor Set
                              </span>
                              {match.sets_data && match.sets_data.length > 0 && (
                                <div className="mt-2 text-[10px] font-mono font-medium flex flex-wrap gap-1 justify-center max-w-[120px]">
                                  {match.sets_data.map((set, idx) => (
                                    <span key={idx} className={`px-1.5 py-0.5 rounded border ${idx === match.sets_data!.length - 1 && match.status === 'ongoing' ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'bg-muted/50 border-border text-muted-foreground'}`}>
                                      {set.team1_score}-{set.team2_score}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Team 2 */}
                            <div className="flex-1 text-center min-w-0 flex flex-col items-center gap-1">
                              <div className="font-bold text-sm sm:text-base truncate">
                                {renderTeamName(match.team2, "TBD", match.id)}
                              </div>
                              {match.team2?.members && match.team2.members.length > 0 && (
                                <ul className="space-y-0.5 max-h-[50px] overflow-y-auto scrollbar-none w-full flex flex-col items-center">
                                  {match.team2.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as unknown as { house?: { block: string; number: string } })?.house;
                                    return (
                                      <li key={m.id} className="text-[10px] text-muted-foreground truncate max-w-[90%] flex items-center justify-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-primary/40 shrink-0" />
                                        <span>{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              {match.sets_data && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Set Won: <span className="font-bold text-primary">{setsWon2}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              Peserta Teratas:
                            </div>
                            <div className="grid gap-1.5">
                              {match.participants?.slice(0, 3).map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between text-sm bg-muted/30 px-3 py-1.5 rounded-lg border">
                                  <div className="flex items-center gap-2 font-medium">
                                    <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                                    <span className="truncate">{p.team?.name || "Peserta"}</span>
                                  </div>
                                  <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border">
                                    {p.score || "0"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 pt-3 border-t border-dashed text-[11px] text-muted-foreground">
                          {match.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span>{match.location}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between w-full mt-1.5">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                              {formatMatchTime(match.match_datetime)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2.5 font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBroadcastMatchIds([match.id]);
                                  setIsBroadcastOpen(true);
                                }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                Broadcast
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2.5 font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary">
                                <Eye className="w-3 h-3" />
                                Lihat Detail
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingMatches.length === 0 ? (
              <Card className="border-dashed py-16">
                <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-bold text-lg">Tidak ada pertandingan mendatang</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Saat ini tidak ada pertandingan terjadwal berikutnya. Silakan hubungi panitia.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 border rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">
                    Menampilkan <span className="font-semibold text-foreground">{upcomingMatches.length}</span> pertandingan mendatang
                  </div>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-[10px]"
                    onClick={() => {
                      setSelectedBroadcastMatchIds(upcomingMatches.map(m => m.id));
                      setIsBroadcastOpen(true);
                    }}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Broadcast Semua
                  </Button>
                </div>

                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                {upcomingMatches.map((match) => {
                  const is17an = match.competition?.format === "17an";

                  return (
                    <Card 
                      key={match.id} 
                      className="overflow-hidden border-border/80 hover:border-primary/30 transition-all duration-300 flex flex-col"
                    >
                      <div className="bg-muted/40 px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getSportEmoji(match.competition?.sport_name)}</span>
                          <span className="font-semibold text-muted-foreground truncate max-w-[200px]">
                            {match.competition?.custom_match_label || match.competition?.sport_name}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground tracking-wide px-2 py-0.5">
                          Akan Datang
                        </Badge>
                      </div>

                      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 sm:gap-4">
                        <div className="text-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {match.phase_label || "Group Stage"} {match.group_name ? `• ${match.group_name}` : ""}
                        </div>

                        {!is17an ? (
                          <div className="flex items-start justify-between gap-3 py-2">
                            {/* Team 1 */}
                            <div className="flex-1 min-w-0 bg-muted/20 rounded-xl border border-dashed px-3 py-2.5 flex flex-col items-center gap-1.5">
                              <span className="font-bold text-sm text-center truncate w-full flex items-center justify-center gap-1.5">
                                <TeamFlag team={match.team1} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                <span>{match.team1 ? extractFlagAndName(match.team1.name).name : "Tim 1"}</span>
                              </span>
                              {match.team1?.members && match.team1.members.length > 0 && (
                                <ul className="w-full space-y-0.5">
                                  {match.team1.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                                    return (
                                      <li key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <div className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                                        <span className="truncate">{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                            <span className="text-[10px] font-black text-muted-foreground/30 italic px-1 shrink-0 mt-3">VS</span>
                            {/* Team 2 */}
                            <div className="flex-1 min-w-0 bg-muted/20 rounded-xl border border-dashed px-3 py-2.5 flex flex-col items-center gap-1.5">
                              <span className="font-bold text-sm text-center truncate w-full flex items-center justify-center gap-1.5">
                                <TeamFlag team={match.team2} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                <span>{match.team2 ? extractFlagAndName(match.team2.name).name : "Tim 2"}</span>
                              </span>
                              {match.team2?.members && match.team2.members.length > 0 && (
                                <ul className="w-full space-y-0.5">
                                  {match.team2.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                                    return (
                                      <li key={m.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <div className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                                        <span className="truncate">{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="py-2 text-center">
                            <div className="text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1.5 bg-muted/20 px-4 py-2.5 rounded-xl border border-dashed">
                              <Users className="w-4 h-4 text-muted-foreground/60" />
                              Pertandingan Individual (17an)
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 pt-3 border-t border-dashed text-[11px] text-muted-foreground">
                          {match.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span>{match.location}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between w-full mt-1.5">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span className="font-semibold text-foreground/80">
                                {formatMatchTime(match.match_datetime)}
                              </span>
                                    </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2.5 font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBroadcastMatchIds([match.id]);
                                  setIsBroadcastOpen(true);
                                }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                Broadcast
                              </Button>
                              {canManageMatch(match) && (
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 px-2.5 font-bold uppercase tracking-wider bg-primary hover:bg-primary/90"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const hasReferee = (match.competition?.referees?.length || 0) > 0;
                                    if (!hasReferee) {
                                      setPendingStartMatchId(match.id);
                                      return;
                                    }
                                    startMatchMutation.mutate(match.id);
                                  }}
                                  disabled={startMatchMutation.isPending}
                                >
                                  <Play className="w-3 h-3" />
                                  Mulai
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedMatches.length === 0 ? (
              <Card className="border-dashed py-16">
                <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-bold text-lg">Belum ada pertandingan selesai</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Pertandingan yang sudah selesai akan muncul di sini.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                {completedMatches.map((match) => {
                  const is17an = match.competition?.format === "17an";
                  const setsWon1 = Array.isArray(match.sets_data) 
                    ? match.sets_data.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length 
                    : 0;
                  const setsWon2 = Array.isArray(match.sets_data) 
                    ? match.sets_data.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length 
                    : 0;

                  return (
                    <Card 
                      key={match.id} 
                      className="overflow-hidden border-border/80 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col cursor-pointer opacity-80 hover:opacity-100"
                      onClick={() => {
                        setSelectedMatch(match);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="bg-muted/40 px-4 py-2 border-b border-border/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getSportEmoji(match.competition?.sport_name)}</span>
                          <span className="font-semibold text-foreground/70 truncate max-w-[200px]">
                            {match.competition?.custom_match_label || match.competition?.sport_name}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase px-2 py-0.5 tracking-wider">
                          Selesai
                        </Badge>
                      </div>

                      <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 sm:gap-4">
                        <div className="text-center text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          {match.phase_label || "Group Stage"} {match.group_name ? `• ${match.group_name}` : ""}
                        </div>

                        {!is17an ? (
                          <div className="flex items-center justify-between gap-2 py-2 opacity-80">
                            {/* Team 1 */}
                            <div className="flex-1 text-center min-w-0">
                              <div className="font-bold text-sm sm:text-base flex items-center justify-center gap-1.5">
                                <TeamFlag team={match.team1} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                <span>{match.team1 ? extractFlagAndName(match.team1.name).name : "TBD"}</span>
                              </div>
                              {match.team1?.members && match.team1.members.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {match.team1.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                                    return (
                                      <li key={m.id} className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                                        <div className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                                        <span className="truncate">{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              {match.sets_data && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Set Won: <span className="font-bold text-primary">{setsWon1}</span>
                                </div>
                              )}
                            </div>

                            {/* Score Display */}
                            <div className="flex flex-col items-center px-4">
                              <div className="flex items-center gap-2 bg-muted/30 border rounded-xl px-4 py-2 font-mono text-2xl font-black tracking-tight shadow-inner">
                                <span className={setsWon1 > setsWon2 ? "text-primary" : ""}>
                                  {setsWon1}
                                </span>
                                <span className="text-muted-foreground/30 text-lg">:</span>
                                <span className={setsWon2 > setsWon1 ? "text-primary" : ""}>
                                  {setsWon2}
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
                                Skor Set
                              </span>
                              {match.sets_data && match.sets_data.length > 0 && (
                                <div className="mt-2 text-[10px] font-mono font-medium flex flex-wrap gap-1 justify-center max-w-[120px]">
                                  {match.sets_data.map((set, idx) => (
                                    <span key={idx} className="px-1.5 py-0.5 rounded border bg-muted/50 border-border text-muted-foreground">
                                      {set.team1_score}-{set.team2_score}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Team 2 */}
                            <div className="flex-1 text-center min-w-0">
                              <div className="font-bold text-sm sm:text-base truncate flex items-center justify-center gap-1.5">
                                <TeamFlag team={match.team2} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                <span>{match.team2 ? extractFlagAndName(match.team2.name).name : "TBD"}</span>
                              </div>
                              {match.team2?.members && match.team2.members.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {match.team2.members.map((m) => {
                                    const parsed = parseMemberName(m.name);
                                    const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                    const house = (m.profile as (typeof m.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                                    return (
                                      <li key={m.id} className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                                        <div className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
                                        <span className="truncate">{name}{house ? ` (${house.block}.${house.number})` : ""}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              {match.sets_data && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  Set Won: <span className="font-bold text-primary">{setsWon2}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 py-1 opacity-80">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              Peserta Teratas:
                            </div>
                            <div className="grid gap-1.5">
                              {match.participants?.slice(0, 3).map((p, idx) => (
                                <div key={p.id} className="flex items-center justify-between text-sm bg-muted/20 px-3 py-1.5 rounded-lg border">
                                  <div className="flex items-center gap-2 font-medium">
                                    <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                                    <span className="truncate">{p.team?.name || "Peserta"}</span>
                                  </div>
                                  <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border">
                                    {p.score || "0"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 pt-3 border-t border-dashed text-[11px] text-muted-foreground">
                          {match.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span>{match.location}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between w-full mt-1.5">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                              {formatMatchTime(match.match_datetime)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 px-2.5 font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBroadcastMatchIds([match.id]);
                                  setIsBroadcastOpen(true);
                                }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                Broadcast
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2.5 font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary">
                                <Eye className="w-3 h-3" />
                                Lihat Detail
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="standings" className="space-y-8">
            {(() => {
              const allGroupMatches = matches.filter(m => m.stage === "group" && m.group_name);
              if (allGroupMatches.length === 0) {
                return (
                  <Card className="border-dashed py-16">
                    <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Trophy className="w-8 h-8 text-muted-foreground/60" />
                      </div>
                      <h3 className="font-bold text-lg">Belum ada klasemen</h3>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Pertandingan fase grup belum dimulai atau tidak ada dalam kompetisi saat ini.
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              const compMap = new Map<string, { comp: EventCompetitionWithDetails, matches: MatchData[], teams: MatchTeam[] }>();
              allGroupMatches.forEach(m => {
                if (!compMap.has(m.competition_id)) {
                  compMap.set(m.competition_id, {
                    comp: m.competition as EventCompetitionWithDetails,
                    matches: [],
                    teams: allTeams.filter(t => t.competition_id === m.competition_id)
                  });
                }
                const data = compMap.get(m.competition_id)!;
                data.matches.push(m);
              });

              return Array.from(compMap.values()).map(data => {
                const mockCompetition = {
                  ...data.comp,
                  teams: data.teams,
                  matches: data.matches
                };
                return (
                  <div key={data.comp.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-primary" />
                        Klasemen {data.comp.custom_match_label || data.comp.sport_name}
                      </h3>
                      {(isAdmin() || isMenteriSistemDigital || data.comp.referees?.some(ref => ref.user_id === user?.id)) && (
                        <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs font-semibold hover:text-primary transition-colors">
                          <Link to={`/competitions/${data.comp.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            Kelola Kompetisi
                          </Link>
                        </Button>
                      )}
                    </div>
                    <GroupStandings competition={mockCompetition as unknown as EventCompetitionWithDetails} />
                  </div>
                );
              });
            })()}
          </TabsContent>

          <TabsContent value="chart" className="space-y-6">
            {(() => {
              const competitionsToShow = selectedCompetitionId === "all"
                ? uniqueCompetitions
                : uniqueCompetitions.filter(c => c.id === selectedCompetitionId);

              if (competitionsToShow.length === 0) {
                return (
                  <Card className="border-dashed py-16">
                    <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <GitBranch className="w-8 h-8 text-muted-foreground/60" />
                      </div>
                      <h3 className="font-bold text-lg">Belum ada kompetisi</h3>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Tidak ada kompetisi yang terdaftar.
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              let filteredChartMatches = matches;
              if (selectedStatus !== "all") {
                filteredChartMatches = filteredChartMatches.filter(m => {
                  if (selectedStatus === "upcoming") return m.status === "scheduled";
                  if (selectedStatus === "completed") return m.status === "completed";
                  if (selectedStatus === "ongoing") return m.status === "ongoing";
                  return true;
                });
              }

              const compsWithMatches = competitionsToShow.map(comp => {
                const compMatches = filteredChartMatches.filter(m => m.competition_id === comp.id);
                return { comp, compMatches };
              }).filter(item => item.compMatches.length > 0);

              if (compsWithMatches.length === 0) {
                return (
                  <Card className="border-dashed py-16">
                    <CardContent className="flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-muted-foreground/60" />
                      </div>
                      <h3 className="font-bold text-lg">Tidak ada pertandingan cocok</h3>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Tidak ada pertandingan dengan status "{selectedStatus === "upcoming" ? "Akan Datang" : selectedStatus === "completed" ? "Selesai" : "Live"}" untuk kompetisi yang dipilih.
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="space-y-8">
                  {compsWithMatches.map(({ comp, compMatches }) => (
                    <div key={comp.id} className="space-y-3 bg-muted/10 p-4 rounded-2xl border border-muted/80 backdrop-blur-sm">
                      <div className="flex items-center gap-2.5 pb-2 border-b border-muted">
                        <span className="text-xl">{getSportEmoji(comp.sport_name)}</span>
                        <div>
                          <h3 className="font-bold text-base text-foreground tracking-tight">
                            Bagan {comp.custom_match_label || comp.sport_name}
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                            Format: {comp.format || "Knockout"} • {compMatches.length} Pertandingan
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <TournamentBracket
                          competitionId={comp.id}
                          matches={compMatches}
                          canManage={false}
                          renderMatchCard={(match) => renderMatchCard(match)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
        </div>
      )}

      {selectedMatch && (
        <LiveScoreDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedMatch(null);
          }}
          match={selectedMatch as unknown as CompetitionMatchWithTeams}
          competition={selectedMatch.competition as unknown as EventCompetitionWithDetails}
          readOnly={!canManageMatch(selectedMatch)}
          canManage={canManageMatch(selectedMatch)}
          onEditMatch={() => {
            setEditingMatch(selectedMatch);
            setDialogOpen(false);
          }}
        />
      )}

      {editingMatch && (
        <UpdateMatchDialog
          open={!!editingMatch}
          onOpenChange={(open) => !open && setEditingMatch(null)}
          match={editingMatch as unknown as CompetitionMatchWithTeams}
          competition={editingMatch.competition as unknown as EventCompetitionWithDetails}
        />
      )}

      {(() => {
        const pendingMatch = matches.find((m) => m.id === pendingStartMatchId);
        return pendingStartMatchId && pendingMatch?.competition ? (
          <AssignRefereeDialog
            open={!!pendingStartMatchId}
            onOpenChange={(open) => {
               if (!open) setPendingStartMatchId(null);
            }}
            competition={pendingMatch.competition as unknown as EventCompetitionWithDetails}
            title="Tentukan Wasit Dulu"
            description="Belum ada wasit di kompetisi ini. Tambahkan wasit terlebih dahulu sebelum memulai pertandingan."
            onAssigned={() => {
              const id = pendingStartMatchId;
              setPendingStartMatchId(null);
              if (id) {
                startMatchMutation.mutate(id);
              }
            }}
          />
        ) : null;
      })()}

      {isBroadcastOpen && (
        <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
          <DialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pr-6">
              <DialogTitle className="block text-center gap-2 text-base font-bold">
                
                Broadcast WhatsApp
              </DialogTitle>
              
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 border-y border-border/60 my-2">
              {/* Left Column: Match Selection */}
              <div className="border border-border/80 rounded-xl p-3.5 bg-muted/5 space-y-3.5">
                <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2.5">
                  <span className="font-bold text-foreground">Jadwal Tersedia</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-emerald-600 hover:text-emerald-500 font-semibold transition-colors"
                      onClick={() => setSelectedBroadcastMatchIds(filteredMatches.map(m => m.id))}
                    >
                      Pilih Semua
                    </button>
                    <span className="text-muted-foreground/30">|</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground font-semibold transition-colors"
                      onClick={() => setSelectedBroadcastMatchIds([])}
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>
                <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
                  {filteredMatches.map((m) => {
                    const isChecked = selectedBroadcastMatchIds.includes(m.id);
                    const is17an = m.competition?.format === "17an";
                    const title = m.competition?.custom_match_label || m.competition?.sport_name || "Pertandingan";
                    const team1Name = m.team1 ? extractFlagAndName(m.team1.name).name : "Tim 1";
                    const team2Name = m.team2 ? extractFlagAndName(m.team2.name).name : "Tim 2";
                    const matchLabel = is17an ? "Pertandingan 17an" : `${team1Name} vs ${team2Name}`;

                    const team1Members = m.team1?.members?.map(mem => {
                      const parsed = parseMemberName(mem.name);
                      const name = capitalizeName(mem.profile?.full_name?.trim() || parsed.name || "Pemain");
                      const house = (mem.profile as unknown as { house?: { block: string; number: string } })?.house;
                      return house ? `${name} (${house.block}.${house.number})` : name;
                    }).join(" & ") || "";

                    const team2Members = m.team2?.members?.map(mem => {
                      const parsed = parseMemberName(mem.name);
                      const name = capitalizeName(mem.profile?.full_name?.trim() || parsed.name || "Pemain");
                      const house = (mem.profile as unknown as { house?: { block: string; number: string } })?.house;
                      return house ? `${name} (${house.block}.${house.number})` : name;
                    }).join(" & ") || "";

                    const membersLabel = !is17an && (team1Members || team2Members)
                      ? `${team1Members || "?"} vs ${team2Members || "?"}`
                      : "";

                    return (
                      <label
                        key={m.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200 select-none",
                          isChecked 
                            ? "border-emerald-500/40 bg-emerald-50/5 dark:bg-emerald-950/10 shadow-sm" 
                            : "border-border bg-card hover:bg-muted/40 hover:border-border"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBroadcastMatchIds([...selectedBroadcastMatchIds, m.id]);
                            } else {
                              setSelectedBroadcastMatchIds(selectedBroadcastMatchIds.filter(id => id !== m.id));
                            }
                          }}
                          className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate flex items-center gap-1">
                            <span>{getSportEmojiString(m.competition?.sport_name)}</span>
                            <span>{title}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5 font-medium">
                            {matchLabel}
                          </div>
                          {membersLabel && (
                            <div className="text-[9px] text-muted-foreground/80 truncate mt-1 italic font-normal">
                              {membersLabel}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Message Preview */}
              <div className="space-y-1.5 flex flex-col h-full">
                <label className="text-xs font-semibold text-muted-foreground font-sans">Pratinjau Pesan</label>
                <Textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="flex-1 min-h-[250px] font-mono text-xs leading-relaxed resize-none focus-visible:ring-emerald-500 border rounded-xl p-3 bg-muted/5"
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto gap-1.5 font-bold uppercase tracking-wider text-[11px]"
                onClick={() => {
                  navigator.clipboard.writeText(broadcastMessage);
                  toast({
                    title: "Pesan Disalin",
                    description: "Format pesan WhatsApp telah disalin ke clipboard.",
                  });
                }}
              >
                <Copy className="w-3.5 h-3.5" />
                Salin Pesan
              </Button>
              <Button
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-bold uppercase tracking-wider text-[11px]"
                onClick={() => {
                  const encoded = encodeURIComponent(broadcastMessage);
                  window.open(`https://wa.me/?text=${encoded}`, "_blank");
                }}
              >
                <Send className="w-3.5 h-3.5" />
                Kirim ke WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </section>
    </TooltipProvider>
  );
}
