import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Clock, MapPin, Radio, Calendar, Users, Eye, CheckCircle2, ArrowLeft } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { id } from "date-fns/locale";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import LiveScoreDialog from "@/components/competitions/LiveScoreDialog";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GroupStandings } from "@/components/competitions/GroupStandings";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails } from "@/types/competition";

interface MatchTeam {
  id: string;
  name: string;
  members?: { id: string, name: string | null, user_id?: string | null, profile?: { full_name: string | null } }[];
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
  const { canManageContent } = useAuth();
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "upcoming" | "completed" | "standings">("live");
  const [openMemberPopover, setOpenMemberPopover] = useState<string | null>(null);

  // Close member popover on any click outside
  useEffect(() => {
    if (!openMemberPopover) return;
    const handler = () => setOpenMemberPopover(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openMemberPopover]);

  // Fetch matches (ongoing, scheduled, and completed)
  const { data: matches = [], isLoading, error } = useQuery<MatchData[]>({
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
            sets_per_match
          ),
          team1:competition_teams!team1_id (
            id,
            name,
            members:competition_team_members(id, name, user_id)
          ),
          team2:competition_teams!team2_id (
            id,
            name,
            members:competition_team_members(id, name, user_id)
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
              members:competition_team_members(id, name, user_id)
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

      let profileMap = new Map<string, { id: string, full_name: string | null }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIds));
        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }

      const attachProfile = (team: MatchTeam | null) => {
        if (!team || !team.members) return;
        team.members = team.members.map((mem) => ({
          ...mem,
          profile: mem.user_id ? profileMap.get(mem.user_id) : undefined
        }));
      };

      rawMatches.forEach((m) => {
        attachProfile(m.team1);
        attachProfile(m.team2);
        m.participants?.forEach((p) => attachProfile(p.team));
      });

      return rawMatches as unknown as MatchData[];
    },
    refetchInterval: (query) => {
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
          id, name, group_name, competition_id,
          members:competition_team_members(id, name, user_id)
        `)
        .in("competition_id", compIds)
        .not("group_name", "is", null);
        
      if (error) throw error;
      
      const teams = data || [];
      const userIds = new Set<string>();
      teams.forEach((t) => t.members?.forEach((m: { user_id?: string | null }) => { if (m.user_id) userIds.add(m.user_id); }));
      
      let profileMap = new Map<string, { id: string, full_name: string | null }>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(userIds));
        profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      }
      
      return teams.map(t => ({
        ...t,
        members: t.members?.map((m: { id: string, name: string | null, user_id: string | null }) => ({
          ...m,
          profile: m.user_id ? profileMap.get(m.user_id) : undefined
        }))
      })) as (MatchTeam & { competition_id: string })[];
    },
    enabled: compIds.length > 0
  });

  const ongoingMatches = matches.filter((m) => m.status === "ongoing");
  const upcomingMatches = matches.filter((m) => m.status === "scheduled");
  const completedMatches = matches.filter((m) => m.status === "completed");

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

  const renderTeamName = (team: MatchTeam | null, defaultName: string) => {
    if (!team) return <span className="truncate max-w-full inline-block align-bottom">{defaultName}</span>;
    
    if (team.members && team.members.length > 0) {
      const popoverId = team.id;
      const isPopoverOpen = openMemberPopover === popoverId;
      return (
        <div className="relative inline-flex flex-col items-center max-w-full">
          {isPopoverOpen && (
            <div
              className="absolute bottom-full mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-3 min-w-[140px] text-left animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-semibold mb-1.5">Anggota Tim:</div>
              <ul className="text-xs space-y-1">
                {team.members.map(m => (
                  <li key={m.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {(m.name?.trim() || m.profile?.full_name?.trim()) || "Pemain"}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger
              className="cursor-pointer inline-flex items-center gap-1 hover:text-primary transition-colors max-w-full"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMemberPopover(isPopoverOpen ? null : popoverId);
              }}
            >
              <span className="truncate">{team.name}</span>
              <Users className="w-3 h-3 shrink-0 opacity-50" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-sm font-semibold mb-1">Anggota Tim:</div>
              <ul className="text-xs space-y-1">
                {team.members.map(m => (
                  <li key={m.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {(m.name?.trim() || m.profile?.full_name?.trim()) || "Pemain"}
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>
      );
    }
    
    return <span className="truncate max-w-full inline-block align-bottom">{team.name}</span>;
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
                <p className="text-muted-foreground mt-1 text-sm sm:text-base leading-snug max-w-lg">
                  Pantau skor pertandingan yang sedang berlangsung secara real-time dan lihat jadwal pertandingan mendatang.
                </p>
              </motion.div>
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
        <Tabs defaultValue="live" value={activeTab} onValueChange={(v) => setActiveTab(v as "live" | "upcoming" | "completed" | "standings")} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full h-11 p-1 bg-muted/60 border rounded-xl">
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
                            <div className="flex-1 text-center min-w-0">
                              <div className="font-bold text-sm">
                                {renderTeamName(match.team1, "TBD")}
                              </div>
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
                            <div className="flex-1 text-center min-w-0">
                              <div className="font-bold text-sm sm:text-base truncate">
                                {renderTeamName(match.team2, "TBD")}
                              </div>
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
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2.5 font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary">
                              <Eye className="w-3 h-3" />
                              Lihat Detail
                            </Button>
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
                          <div className="flex items-center justify-between gap-3 py-2 text-center">
                            <div className="flex-1 font-bold text-sm bg-muted/20 px-2 py-2.5 rounded-xl border border-dashed flex items-center justify-center min-w-0">
                              {renderTeamName(match.team1, "Tim 1")}
                            </div>
                            <span className="text-[10px] font-black text-muted-foreground/30 italic px-1 shrink-0">VS</span>
                            <div className="flex-1 font-bold text-sm bg-muted/20 px-2 py-2.5 rounded-xl border border-dashed flex items-center justify-center min-w-0">
                              {renderTeamName(match.team2, "Tim 2")}
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
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                            <span className="font-semibold text-foreground/80">
                              {formatMatchTime(match.match_datetime)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
                              <div className="font-bold text-sm sm:text-base">
                                {renderTeamName(match.team1, "TBD")}
                              </div>
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
                              <div className="font-bold text-sm sm:text-base truncate">
                                {renderTeamName(match.team2, "TBD")}
                              </div>
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
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 px-2.5 font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary">
                              <Eye className="w-3 h-3" />
                              Lihat Detail
                            </Button>
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
                  advance_per_group: 2,
                  teams: data.teams,
                  matches: data.matches
                };
                return (
                  <div key={data.comp.id} className="space-y-3">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Klasemen {data.comp.custom_match_label || data.comp.sport_name}
                    </h3>
                    <GroupStandings competition={mockCompetition as unknown as EventCompetitionWithDetails} />
                  </div>
                );
              });
            })()}
          </TabsContent>
        </Tabs>
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
          readOnly={!canManageContent()} // Administrators/referees can manage/edit directly, other users can view only!
        />
      )}
      </div>
    </section>
    </TooltipProvider>
  );
}
