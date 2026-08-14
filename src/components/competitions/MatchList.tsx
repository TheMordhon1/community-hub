import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Trophy, Calendar, MapPin, Edit, RefreshCw, Trash2, MoreVertical, Medal, Eye, CheckCircle2, Sparkles, X, List, GitBranch, ChevronLeft, ChevronRight, GitMerge } from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
import type { EventCompetitionWithDetails, CompetitionMatchWithTeams, CompetitionTeamWithMembers } from "@/types/competition";
import { MATCH_STATUS_LABELS } from "@/types/competition";
import { UpdateMatchDialog } from "@/components/competitions/UpdateMatchDialog";
import LiveScoreDialog from "@/components/competitions/LiveScoreDialog";
import { SpinWheelDialog } from "@/components/competitions/SpinWheelDialog";
import { AssignRefereeDialog } from "@/components/competitions/AssignRefereeDialog";
import { Play } from "lucide-react";
import { useResetMatch, useDeleteMatch, useUpdateMatch, useAssignMatchTeams, useGenerateBracket, useGenerateKnockoutFromGroups, useAdvance17anRound, useResetKnockoutPhase, useCreateMatch, useGenerate17an } from "@/hooks/useCompetitions";
import {
  areAllGroupMatchesCompleted,
  computeStandings,
  hasGroupMatches,
  hasKnockoutMatches,
  seedKnockoutFromStandings,
} from "@/lib/liga-group";
import { getTeamFlag, extractFlagAndName } from "@/lib/countries";
import { TeamFlag } from "./TeamFlag";
import { TournamentBracket } from "./TournamentBracket";
import { MatchPhaseEditor } from "./MatchPhaseEditor";
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
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MatchListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
  headerActions?: React.ReactNode;
}

export function MatchList({ competition, canManage, headerActions }: MatchListProps) {
  const [editingMatch, setEditingMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [liveScoringMatch, setLiveScoringMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [viewingMatch, setViewingMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [spinningMatch, setSpinningMatch] = useState<CompetitionMatchWithTeams | null>(null);
  const [spinningMatchContext, setSpinningMatchContext] = useState<{ match: CompetitionMatchWithTeams; teamPosition: 1 | 2 } | null>(null);
  const [matchToReset, setMatchToReset] = useState<string | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<string | null>(null);
  const [pendingStartMatchId, setPendingStartMatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedChartRound, setSelectedChartRound] = useState<string>("all");

  const resetMatch = useResetMatch();
  const deleteMatch = useDeleteMatch();
  const updateMutation = useUpdateMatch();
  const assignTeams = useAssignMatchTeams();
  const generateBracket = useGenerateBracket();
  const generateKnockout = useGenerateKnockoutFromGroups();
  const advanceRound = useAdvance17anRound();
  const create17anSchedule = useGenerate17an();
  const resetKnockout = useResetKnockoutPhase();
  const createMatch = useCreateMatch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
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

  const rawRounds = matches.map((m) => m.round_number);
  const totalRounds = rawRounds.length > 0 ? Math.max(...rawRounds) : 0;
  
  const uniqueRounds = Array.from(new Set(rawRounds)).sort((a, b) => a - b);
  const roundNames = uniqueRounds.map(r => {
    const roundMatches = matches.filter(m => m.round_number === r);
    const customLabel = roundMatches.find(m => m.phase_label)?.phase_label?.trim();
    if (customLabel) return { round: r, name: customLabel };
    
    if (competition.stages && competition.stages.length > 0) {
      if (roundMatches[0]?.stage === "group") {
        const maxOrder = Math.max(...competition.stages.map(s => s.order_number));
        const groupStageName = competition.stages.find(s => s.order_number === maxOrder);
        if (groupStageName) return { round: r, name: groupStageName.name };
      } else {
        const knockoutMatches = matches.filter(m => m.stage === "knockout");
        const maxKnockoutRound = knockoutMatches.length > 0 ? Math.max(...knockoutMatches.map(m => m.round_number)) : 0;
        const fromEnd = maxKnockoutRound - r + 1;
        const stageMatch = competition.stages.find(s => s.order_number === fromEnd);
        if (stageMatch) return { round: r, name: stageMatch.name };
      }
    }

    const fromEnd = totalRounds - r + 1;
    let name = `Babak ${r}`;
    if (fromEnd === 1) name = "Final";
    else if (fromEnd === 2) name = "Semi Final";
    else if (fromEnd === 3) name = "Perempat Final";
    return { round: r, name };
  });

  const getEligibleTeamsForMatch = (match: CompetitionMatchWithTeams) => {
    let baseEligible = allTeams;
    
    if (competition.format === "liga_grup" && match.stage === "knockout") {
      const advance = competition.advance_per_group || 2;
      const groupNamesSet = Array.from(new Set(allTeams.filter(t => !!t.group_name).map(t => t.group_name!)));
      
      const eligibleIds = new Set<string>();
      groupNamesSet.forEach(g => {
        const standings = computeStandings(allTeams, matches, g);
        standings.slice(0, advance).forEach(row => eligibleIds.add(row.team.id));
      });
      
      allTeams.forEach(t => {
        if (t.next_stage_label) {
          eligibleIds.add(t.id);
        }
      });
      
      baseEligible = allTeams.filter(t => eligibleIds.has(t.id));
    }
    
    return baseEligible;
  };

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
      
      const team1WithMembers = match.team1 as CompetitionTeamWithMembers | undefined;
      const team2WithMembers = match.team2 as CompetitionTeamWithMembers | undefined;

      const matchesMember = 
        team1WithMembers?.members?.some(m => 
          clean(m.name).includes(q) || 
          clean(m.profile?.full_name).includes(q)
        ) ||
        team2WithMembers?.members?.some(m => 
          clean(m.name).includes(q) || 
          clean(m.profile?.full_name).includes(q)
        ) ||
        match.participants?.some(p => 
          (p.team as CompetitionTeamWithMembers | undefined)?.members?.some(m => 
            clean(m.name).includes(q) || 
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

    // 3. Filter by phase/round
    if (selectedRound !== "all") {
      if (match.round_number !== Number(selectedRound)) {
        return false;
      }
    }

    // 4. Filter by status
    if (selectedStatus !== "all") {
      if (selectedStatus === "upcoming" && match.status !== "scheduled") {
        return false;
      }
      if (selectedStatus === "completed" && match.status !== "completed") {
        return false;
      }
      if (selectedStatus === "ongoing" && match.status !== "ongoing") {
        return false;
      }
    }

    return true;
  });

  const getMatchPhaseName = (match: CompetitionMatchWithTeams) => {
    if (match.phase_label) return match.phase_label;

    const round = match.round_number;
    if (competition.stages && competition.stages.length > 0) {
      if (match.stage === "group") {
        const maxOrder = Math.max(...competition.stages.map(s => s.order_number));
        const groupStageName = competition.stages.find(s => s.order_number === maxOrder);
        if (groupStageName) return groupStageName.name;
      } else {
        const knockoutMatches = competition.matches?.filter(m => m.stage === "knockout") || [];
        const maxKnockoutRound = knockoutMatches.length > 0 ? Math.max(...knockoutMatches.map(m => m.round_number)) : 0;
        const fromEnd = maxKnockoutRound - round + 1;
        const stageMatch = competition.stages.find(s => s.order_number === fromEnd);
        if (stageMatch) return stageMatch.name;
      }
    }

    const fromEnd = totalRounds - round + 1;
    if (fromEnd === 1) return "Final";
    if (fromEnd === 2) return "Semi Final";
    if (fromEnd === 3) return "Perempat Final";
    return `Babak ${round}`;
  };

  // Group matches by phase name
  const matchesByPhase = filteredMatches.reduce((acc, match) => {
    const phaseName = getMatchPhaseName(match);
    if (!acc[phaseName]) acc[phaseName] = [];
    acc[phaseName].push(match);
    return acc;
  }, {} as Record<string, CompetitionMatchWithTeams[]>);

  // Sort matches within each phase by datetime (descending - latest first, nulls last), then by match_number
  const timeOf = (m: CompetitionMatchWithTeams) =>
    m.match_datetime ? new Date(m.match_datetime).getTime() : 0;

  Object.keys(matchesByPhase).forEach((phaseName) => {
    matchesByPhase[phaseName].sort((a, b) => {
      if (!a.match_datetime && b.match_datetime) return 1;
      if (a.match_datetime && !b.match_datetime) return -1;
      if (!a.match_datetime && !b.match_datetime) return (a.match_number || 0) - (b.match_number || 0);

      const diff = timeOf(b) - timeOf(a);
      if (diff !== 0) return diff;
      return (a.match_number || 0) - (b.match_number || 0);
    });
  });



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
          value={selectedRound}
          onValueChange={setSelectedRound}
        >
          <SelectTrigger className="w-full md:w-[180px] bg-background shrink-0">
            <SelectValue placeholder="Pilih Babak" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Babak</SelectItem>
            {roundNames.map((rn) => (
              <SelectItem key={rn.round} value={String(rn.round)}>
                {rn.name}
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
                  format(selectedDate, "dd MMMM yyyy", { locale: idLocale })
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

        {viewMode === "chart" && (
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

        {(searchQuery || selectedDate || selectedRound !== "all" || selectedStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setSelectedDate(undefined);
              setSelectedRound("all");
              setSelectedStatus("all");
            }}
            className="h-10 text-muted-foreground hover:text-foreground shrink-0 w-full md:w-auto"
          >
            Reset Filter
          </Button>
        )}
      </div>

      {/* View Mode Toggle */}
      {matches.length > 0 && (
        <div className="flex items-center justify-between bg-muted/20 p-2.5 rounded-xl border">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Tampilan Pertandingan</span>
          </div>
          <div className="flex items-center bg-background p-1 rounded-lg border shadow-sm">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 font-medium"
              onClick={() => setViewMode("list")}
            >
              <List className="w-3.5 h-3.5" />
              Daftar
            </Button>
            <Button
              variant={viewMode === "chart" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 font-medium"
              onClick={() => setViewMode("chart")}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Bagan
            </Button>
          </div>
        </div>
      )}

      {(() => {
        const renderMatchCard = (match: CompetitionMatchWithTeams, index: number) => {
          // Compute effective scores from sets_data if sets exist (badminton/multi-set),
          // otherwise fall back to stored score1/score2.
          const setsArr = Array.isArray(match.sets_data) ? match.sets_data : [];
          const setsWon1 = setsArr.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length;
          const setsWon2 = setsArr.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length;
          const displayScore1 = setsArr.length > 0 ? String(setsWon1) : (match.score1 || "");
          const displayScore2 = setsArr.length > 0 ? String(setsWon2) : (match.score2 || "");
          const hasScoreValues = setsArr.length > 0 || match.score1 !== null || match.score2 !== null;
          return (
            <Card id={`match-card-${match.id}`} key={match.id} className="overflow-hidden bg-card/60 backdrop-blur border shadow-sm hover:border-primary/40 transition-colors">
              <CardContent className="p-0">
                {/* Match Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                  <div className="flex items-center gap-1.5 group relative min-w-0">
                    <span className="text-xs font-semibold sm:font-normal text-muted-foreground truncate">
                      {match.notes ? match.notes : `Match ${index + 1}`} {match.group_name && `· Grup ${match.group_name}`}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onClick={() => {
                            const newLabel = window.prompt("Ubah Label Pertandingan (kosongkan untuk kembali ke default):", match.notes || `Match ${index + 1}`);
                            if (newLabel !== null) {
                              updateMutation.mutate({
                                id: match.id,
                                competition_id: competition.id,
                                notes: newLabel || null
                              });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary shrink-0"
                          title="Ubah Label"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <MatchPhaseEditor
                          match={match}
                          allMatches={matches}
                          onUpdate={(newRound, newPhase) => {
                            updateMutation.mutate({
                              id: match.id,
                              competition_id: competition.id,
                              round_number: newRound,
                              phase_label: newPhase
                            });
                          }}
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary shrink-0 ml-1"
                              title="Hubungkan ke Pertandingan Selanjutnya"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GitMerge className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                            <Label className="text-xs font-bold mb-1.5 block">Hubungkan ke Pertandingan Selanjutnya</Label>
                            <Select
                              value={match.next_match_id || "none"}
                              onValueChange={(val) => {
                                const newNextMatchId = val === "none" ? null : val;
                                updateMutation.mutate({
                                  id: match.id,
                                  competition_id: competition.id,
                                  next_match_id: newNextMatchId
                                });
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih Pertandingan" />
                              </SelectTrigger>
                              <SelectContent className="max-h-56">
                                <SelectItem value="none">Tidak ada (Babak Final / Berdiri Sendiri)</SelectItem>
                                {matches
                                  .filter((m) => m.id !== match.id)
                                  .map((m, idx) => {
                                    const team1Name = m.team1 ? extractFlagAndName(m.team1.name).name : "TBD";
                                    const team2Name = m.team2 ? extractFlagAndName(m.team2.name).name : "TBD";
                                    const label = m.notes || `Pertandingan ${idx + 1}`;
                                    const roundName = m.phase_label || `Babak ${m.round_number || 1}`;
                                    return (
                                      <SelectItem key={m.id} value={m.id}>
                                        <div className="flex flex-col text-[10px] py-0.5 text-left">
                                          <span className="font-semibold text-foreground truncate">{label} ({roundName})</span>
                                          <span className="text-muted-foreground truncate">{team1Name} vs {team2Name}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                              </SelectContent>
                            </Select>
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                    {match.is_final && (
                      <Trophy className="w-3 h-3 text-yellow-500 fill-yellow-500 animate-pulse shrink-0" />
                    )}
                  </div>
                  <Badge variant={getStatusVariant(match.status)} className={`text-xs shrink-0 ${match.status === 'ongoing' ? 'pl-5 relative' : ''}`}>
                    {match.status === 'ongoing' && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                      </span>
                    )}
                    {MATCH_STATUS_LABELS[match.status]}
                  </Badge>
                </div>

                {/* Teams */}
                <div className="p-4">
                  <div className="space-y-3">
                    {match.participants && match.participants.length > 0 ? (
                      match.participants.map((p, idx) => (
                        <div key={p.id}>
                          {idx > 0 && <div className="border-t my-3" />}
                          <div className={`flex items-center justify-between ${p.is_winner ? 'font-bold text-primary' : ''}`}>
                            <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {match.is_point !== false && (
                                  <>
                                    {match.is_final ? (
                                      <>
                                        {p.winner_rank === 1 && <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                        {p.winner_rank === 2 && <Trophy className="w-4 h-4 text-slate-400 fill-slate-400" />}
                                        {p.winner_rank === 3 && <Trophy className="w-4 h-4 text-amber-600 fill-amber-600" />}
                                        {(p.is_winner && !p.winner_rank) && <Trophy className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                      </>
                                    ) : (
                                      <>
                                        {p.is_winner && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                      </>
                                    )}
                                  </>
                                )}
                                {canManage ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <div 
                                        role="button"
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 transition-colors group/team cursor-pointer"
                                      >
                                        <TeamFlag team={p.team} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                        <span className={`text-sm ${!p.team ? 'text-muted-foreground italic' : ''}`}>
                                          {p.team ? extractFlagAndName(p.team.name).name : "TBD"}
                                        </span>
                                        <Edit className="w-3 h-3 opacity-0 group-hover/team:opacity-100 transition-opacity ml-1 text-muted-foreground" />
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-2" align="start">
                                      <Label className="text-xs font-bold mb-1.5 block">Ubah Peserta {idx + 1}</Label>
                                      <Select 
                                        value={p.team_id || "none"} 
                                        onValueChange={async (val) => {
                                          const newTeamId = val === "none" ? null : val;
                                          if (newTeamId) {
                                            const { error } = await supabase
                                              .from("competition_match_participants")
                                              .update({ team_id: newTeamId })
                                              .eq("id", p.id);
                                            if (error) {
                                              toast({ variant: "destructive", title: "Gagal", description: "Gagal mengubah tim: " + error.message });
                                            } else {
                                              queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
                                              queryClient.invalidateQueries({ queryKey: ["live-matches"] });
                                              toast({ title: "Berhasil", description: "Tim berhasil diubah" });
                                            }
                                          } else {
                                            const { error } = await supabase
                                              .from("competition_match_participants")
                                              .update({ team_id: null })
                                              .eq("id", p.id);
                                            if (error) {
                                              toast({ variant: "destructive", title: "Gagal", description: "Gagal mengosongkan tim" });
                                            } else {
                                              queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
                                              queryClient.invalidateQueries({ queryKey: ["live-matches"] });
                                              toast({ title: "Berhasil", description: "Tim berhasil dikosongkan" });
                                            }
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="w-full">
                                          <SelectValue placeholder="Pilih Tim" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">Pilih Tim (TBD)</SelectItem>
                                          {getEligibleTeamsForMatch(match).map((t) => {
                                            const flag = getTeamFlag(t);
                                            const isEmoji = flag && !flag.includes("/");
                                            const isAlreadySelected = match.participants?.some(otherP => otherP.id !== p.id && otherP.team_id === t.id);
                                            return (
                                              <SelectItem key={t.id} value={t.id} disabled={isAlreadySelected}>
                                                <span className="flex items-center gap-1.5">
                                                  {isEmoji && <span className="text-base select-none shrink-0">{flag}</span>}
                                                  <span>{extractFlagAndName(t.name).name}</span>
                                                </span>
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <>
                                    <TeamFlag team={p.team} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                    <span className="text-sm">
                                      {p.team ? extractFlagAndName(p.team.name).name : "TBD"}
                                    </span>
                                  </>
                                )}
                              </div>
                              {/* Members under team name in participants path */}
                              {(p.team as (typeof p.team & { members?: { id: string; name: string | null; user_id: string | null; profile?: { full_name: string | null; house?: { block: string; number: string } } }[] }) | undefined)?.members?.map((m) => {
                                const parsed = parseMemberName(m.name);
                                const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Pemain");
                                const house = (m.profile as { house?: { block: string; number: string } } | null | undefined)?.house;
                                return (
                                  <div key={m.id} className="flex items-center gap-1 text-[10px] text-muted-foreground pl-6">
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 inline-block" />
                                    {name}{house ? ` (${house.block}.${house.number})` : ""}
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-base font-mono">
                              {match.is_point !== false ? (
                                p.score || "-"
                              ) : (
                                p.is_winner && (
                                  match.is_final ? (
                                    p.winner_rank === 1 ? <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> :
                                    p.winner_rank === 2 ? <Trophy className="w-5 h-5 text-slate-400 fill-slate-400" /> :
                                    p.winner_rank === 3 ? <Trophy className="w-5 h-5 text-amber-600 fill-amber-600" /> :
                                    <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                  ) : (
                                    <CheckCircle2 className="w-5 h-5 text-primary" />
                                  )
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
                          <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {match.is_point !== false && (
                                <>
                                  {match.is_final ? (
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
                                  ) : (
                                    <>
                                      {(match.winner_id === match.team1_id || match.participants?.find(p => p.team_id === match.team1_id)?.is_winner) && (
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                              {canManage && match.status !== "completed" && match.status !== "ongoing" ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div 
                                      role="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 transition-colors group/team cursor-pointer"
                                    >
                                      <TeamFlag team={match.team1} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                      <span className={`text-sm ${!match.team1 ? 'text-muted-foreground italic' : ''}`}>
                                        {match.team1 ? extractFlagAndName(match.team1.name).name : "TBD"}
                                      </span>
                                      <Edit className="w-3 h-3 opacity-0 group-hover/team:opacity-100 transition-opacity ml-1 text-muted-foreground" />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-2" align="start">
                                    <Label className="text-xs font-bold mb-1.5 block">Ubah Tim 1</Label>
                                    <Select 
                                      value={match.team1_id || "none"} 
                                      onValueChange={(val) => {
                                        const newTeamId = val === "none" ? null : val;
                                        updateMutation.mutate({
                                          id: match.id,
                                          competition_id: competition.id,
                                          team1_id: newTeamId,
                                          team_ids: [newTeamId, match.team2_id].filter(Boolean) as string[]
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pilih Tim" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Pilih Tim (TBD)</SelectItem>
                                        {getEligibleTeamsForMatch(match).map((t) => {
                                          const flag = getTeamFlag(t);
                                          const isEmoji = flag && !flag.includes("/");
                                          return (
                                            <SelectItem key={t.id} value={t.id} disabled={t.id === match.team2_id}>
                                              <span className="flex items-center gap-1.5">
                                                {isEmoji && <span className="text-base select-none shrink-0">{flag}</span>}
                                                <span>{extractFlagAndName(t.name).name}</span>
                                              </span>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-[10px] gap-1.5 justify-center h-8 font-semibold"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSpinningMatchContext({ match, teamPosition: 1 });
                                        }}
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                                        Pilih Acak (Spinwheel)
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full text-[10px] gap-1.5 justify-center h-8 font-semibold text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateMutation.mutate({
                                            id: match.id,
                                            competition_id: competition.id,
                                            team1_id: null,
                                            team_ids: [null, match.team2_id].filter(Boolean) as string[]
                                          });
                                        }}
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Reset ke TBD
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <>
                                  <TeamFlag team={match.team1} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                  <span className={`text-sm ${!match.team1 ? 'text-muted-foreground italic' : ''}`}>
                                    {match.team1 ? extractFlagAndName(match.team1.name).name : "TBD"}
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Members under team1 name */}
                            {(match.team1 as (typeof match.team1 & { members?: { id: string; name: string | null; user_id: string | null; profile?: { full_name: string | null; house?: { block: string; number: string } } }[] }) | undefined)?.members?.map((m) => {
                              const parsed = parseMemberName(m.name);
                              const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Pemain");
                              const house = (m.profile as { house?: { block: string; number: string } } | null | undefined)?.house;
                              return (
                                <div key={m.id} className="flex items-center gap-1 text-[10px] text-muted-foreground pl-6">
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 inline-block" />
                                  {name}{house ? ` (${house.block}.${house.number})` : ""}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-base font-mono">
                            {hasScoreValues ? (
                              displayScore1 || "0"
                            ) : (
                              ((match.winner_id === match.team1_id || match.participants?.find(p => p.team_id === match.team1_id)?.is_winner || match.participants?.find(p => p.team_id === match.team1_id)?.winner_rank === 1)) && (
                                match.is_final ? <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> : <CheckCircle2 className="w-5 h-5 text-primary" />
                              )
                            )}
                          </span>
                        </div>

                        <div className="border-t my-2" />

                        {/* Team 2 */}
                        <div className={`flex items-center justify-between ${match.winner_id === match.team2_id ? 'font-bold text-primary' : ''}`}>
                          <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {match.is_point !== false && (
                                <>
                                  {match.is_final ? (
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
                                  ) : (
                                    <>
                                      {(match.winner_id === match.team2_id || match.participants?.find(p => p.team_id === match.team2_id)?.is_winner) && (
                                        <CheckCircle2 className="w-4 h-4 text-primary" />
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                              {canManage && match.status !== "completed" && match.status !== "ongoing" ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div 
                                      role="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 transition-colors group/team cursor-pointer"
                                    >
                                      <TeamFlag team={match.team2} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                      <span className={`text-sm ${!match.team2 ? 'text-muted-foreground italic' : ''}`}>
                                        {match.team2 ? extractFlagAndName(match.team2.name).name : "TBD"}
                                      </span>
                                      <Edit className="w-3 h-3 opacity-0 group-hover/team:opacity-100 transition-opacity ml-1 text-muted-foreground" />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-2" align="start">
                                    <Label className="text-xs font-bold mb-1.5 block">Ubah Tim 2</Label>
                                    <Select 
                                      value={match.team2_id || "none"} 
                                      onValueChange={(val) => {
                                        const newTeamId = val === "none" ? null : val;
                                        updateMutation.mutate({
                                          id: match.id,
                                          competition_id: competition.id,
                                          team2_id: newTeamId,
                                          team_ids: [match.team1_id, newTeamId].filter(Boolean) as string[]
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pilih Tim" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Pilih Tim (TBD)</SelectItem>
                                        {getEligibleTeamsForMatch(match).map((t) => {
                                          const flag = getTeamFlag(t);
                                          const isEmoji = flag && !flag.includes("/");
                                          return (
                                            <SelectItem key={t.id} value={t.id} disabled={t.id === match.team1_id}>
                                              <span className="flex items-center gap-1.5">
                                                {isEmoji && <span className="text-base select-none shrink-0">{flag}</span>}
                                                <span>{extractFlagAndName(t.name).name}</span>
                                              </span>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-[10px] gap-1.5 justify-center h-8 font-semibold"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSpinningMatchContext({ match, teamPosition: 2 });
                                        }}
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                                        Pilih Acak (Spinwheel)
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full text-[10px] gap-1.5 justify-center h-8 font-semibold text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateMutation.mutate({
                                            id: match.id,
                                            competition_id: competition.id,
                                            team2_id: null,
                                            team_ids: [match.team1_id, null].filter(Boolean) as string[]
                                          });
                                        }}
                                      >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        Reset ke TBD
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <>
                                  <TeamFlag team={match.team2} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                                  <span className={`text-sm ${!match.team2 ? 'text-muted-foreground italic' : ''}`}>
                                    {match.team2 ? extractFlagAndName(match.team2.name).name : "TBD"}
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Members under team2 name */}
                            {(match.team2 as (typeof match.team2 & { members?: { id: string; name: string | null; user_id: string | null; profile?: { full_name: string | null; house?: { block: string; number: string } } }[] }) | undefined)?.members?.map((m) => {
                              const parsed = parseMemberName(m.name);
                              const name = capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Pemain");
                              const house = (m.profile as { house?: { block: string; number: string } } | null | undefined)?.house;
                              return (
                                <div key={m.id} className="flex items-center gap-1 text-[10px] text-muted-foreground pl-6">
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 inline-block" />
                                  {name}{house ? ` (${house.block}.${house.number})` : ""}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-base font-mono">
                            {hasScoreValues ? (
                              displayScore2 || "0"
                            ) : (
                              ((match.winner_id === match.team2_id || match.participants?.find(p => p.team_id === match.team2_id)?.is_winner || match.participants?.find(p => p.team_id === match.team2_id)?.winner_rank === 1)) && (
                                match.is_final ? <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" /> : <CheckCircle2 className="w-5 h-5 text-primary" />
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

                  {/* Match Details & Actions */}
                  <div className="mt-3 pt-3 border-t flex flex-col gap-3 w-full">
                    {/* Left: Date, Place and Age labels */}
                    <div className="flex flex-col gap-1.5 min-w-0 text-xs text-muted-foreground w-full">
                      {(match.age_bracket_label || match.age_bracket_min != null || match.age_bracket_max != null) && (
                        <div className="flex">
                          <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            Umur:{" "}
                            {match.age_bracket_label
                              ? match.age_bracket_label
                              : `${match.age_bracket_min ?? "?"} - ${match.age_bracket_max ?? "?"} thn`}
                          </Badge>
                        </div>
                      )}
                      {canManage ? (
                        <Popover>
                                  <PopoverTrigger asChild>
                                    <div 
                                      role="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors group/date py-0.5 rounded hover:bg-muted/50 px-1 w-fit cursor-pointer"
                                    >
                                      <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                                      <span className="truncate">
                                        {match.match_datetime 
                                          ? format(parseISO(match.match_datetime), "dd MMM yyyy, HH:mm", { locale: idLocale })
                                          : "Set Jadwal Tanding"}
                                      </span>
                                      <Edit className="w-3 h-3 opacity-0 group-hover/date:opacity-100 transition-opacity ml-1" />
                                    </div>
                                  </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <Label className="text-xs font-bold mb-1.5 block">Waktu Pertandingan</Label>
                            <div className="space-y-3">
                              <Input
                                type="datetime-local"
                                defaultValue={match.match_datetime ? match.match_datetime.substring(0, 16) : ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    updateMutation.mutate({
                                      id: match.id,
                                      competition_id: competition.id,
                                      match_datetime: new Date(val).toISOString()
                                    });
                                  }
                                }}
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        match.match_datetime && (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                            <span>{format(parseISO(match.match_datetime), "dd MMM yyyy, HH:mm", { locale: idLocale })}</span>
                          </div>
                        )
                      )}
                      {match.location && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{match.location}</span>
                        </div>
                      )}
                      {!match.match_datetime && !match.location && !(match.age_bracket_label || match.age_bracket_min != null || match.age_bracket_max != null) && (
                        <span className="text-[10px] text-muted-foreground/60 italic">Belum ada info jadwal</span>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 justify-end w-full">
                      {match.status === "scheduled" && canManage && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] sm:text-xs px-2.5 sm:px-3 bg-primary hover:bg-primary/90 shadow-sm font-bold"
                          onClick={() => {
                            const hasReferee = (competition.referees?.length || 0) > 0;
                            if (!hasReferee) {
                              setPendingStartMatchId(match.id);
                              return;
                            }
                            updateMutation.mutate({
                              id: match.id,
                              competition_id: competition.id,
                              status: 'ongoing'
                            });
                          }}
                          disabled={updateMutation.isPending}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          <span>Mulai</span>
                        </Button>
                      )}

                      {match.status === "ongoing" && canManage && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] sm:text-xs px-2.5 sm:px-3 bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 font-bold"
                          onClick={() => setLiveScoringMatch(match)}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          <span>Live Score</span>
                        </Button>
                      )}

                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-[10px] sm:text-xs px-2.5 sm:px-3 gap-1"
                        onClick={() => setViewingMatch(match)}
                      >
                        <Eye className="w-3 h-3" />
                        <span>Detail</span>
                      </Button>
                      
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted shrink-0">
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
                              disabled={match.status === "completed" || match.status === "ongoing" || allTeams.length === 0}
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
              </CardContent>
            </Card>
          );
        };

        const renderCreatePhaseNode = (
          comp: EventCompetitionWithDetails,
          teamsList: CompetitionTeamWithMembers[],
          matchesList: CompetitionMatchWithTeams[]
        ) => {
          if (comp.format === "liga_grup") {
            const knockoutMatches = matchesList.filter(m => m.stage === "knockout");
            
            if (knockoutMatches.length === 0) {
              const hasGroups = teamsList.some(t => !!t.group_name);
              if (!hasGroups) {
                return (
                  <div className="text-center space-y-2 p-4">
                    <p className="text-xs text-muted-foreground font-semibold">Tentukan grup peserta terlebih dahulu di tab Peserta.</p>
                  </div>
                );
              }
              
              const groupNamesSet = Array.from(new Set(teamsList.filter(t => !!t.group_name).map(t => t.group_name!))).sort();
              const groupsDone = areAllGroupMatchesCompleted(matchesList);
              
              return (
                <div className="text-center space-y-3 p-4">
                  <Trophy className="w-8 h-8 text-primary mx-auto opacity-75" />
                  <div>
                    <p className="text-xs font-bold">Buat Babak Gugur</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {groupsDone 
                        ? "Semua laga grup selesai. Klik untuk seeding juara grup ke babak gugur." 
                        : "Laga grup belum selesai. Tetap bisa seeding sekarang jika diinginkan."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      const advance = comp.advance_per_group || 2;
                      const standingsByGroup: Record<string, any[]> = {};
                      groupNamesSet.forEach((g) => {
                        standingsByGroup[g] = computeStandings(teamsList, matchesList, g);
                      });
                      const pairs = seedKnockoutFromStandings(standingsByGroup, advance);
                      generateKnockout.mutate({
                        competition_id: comp.id,
                        pairs,
                        match_datetime: comp.events?.event_date
                          ? `${comp.events.event_date.split("T")[0]}T${comp.events.event_time || "08:00"}`
                          : null,
                        location: comp.events?.location || null,
                      });
                    }}
                    disabled={generateKnockout.isPending}
                    className="w-full text-xs font-bold"
                  >
                    {generateKnockout.isPending ? "Memproses..." : "Generate Babak Gugur"}
                  </Button>
                </div>
              );
            } else {
              return null;
            }
          }
          
          if (comp.format === "17an") {
            const hasMatches = matchesList.length > 0;
            const highestRound = hasMatches ? Math.max(...matchesList.map(m => m.round_number)) : 0;
            const latestMatches = matchesList.filter(m => m.round_number === highestRound);
            const allLatestCompleted = latestMatches.length > 0 && latestMatches.every(m => m.status === 'completed');
            
            if (!hasMatches) {
              return (
                <div className="text-center space-y-3 p-4">
                  <Play className="w-8 h-8 text-primary mx-auto opacity-75" />
                  <div>
                    <p className="text-xs font-bold">Mulai Pertandingan</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Buat jadwal pertama untuk format kompetisi ini.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (teamsList.length === 0) {
                        alert("Belum ada peserta yang terdaftar.");
                        return;
                      }
                      const num = window.prompt("Berapa peserta per pertandingan?", "2");
                      const parsedNum = Math.max(1, parseInt(num || "2", 10) || 1);
                      create17anSchedule.mutate({ 
                        competition_id: comp.id,
                        teams: teamsList,
                        teams_per_match: parsedNum,
                        phase_label: "Babak 1"
                      });
                    }}
                    disabled={create17anSchedule.isPending}
                    className="w-full text-xs font-bold"
                  >
                    {create17anSchedule.isPending ? "Memproses..." : "Buat Jadwal Pertama"}
                  </Button>
                </div>
              );
            }

            return (
              <div className="text-center space-y-3 p-4">
                <Trophy className="w-8 h-8 text-primary mx-auto opacity-75 animate-bounce" />
                <div>
                  <p className="text-xs font-bold">Lanjutkan Babak</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Buat babak baru dari seluruh pemenang saat ini.</p>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newLabel = window.prompt("Nama Babak / Fase baru (Opsional):", `Babak Baru`);
                    if (newLabel !== null) {
                      const isFinal = window.confirm("Apakah babak baru ini ditandai sebagai Babak Final?");
                      advanceRound.mutate({
                        competition_id: comp.id,
                        phase_label: newLabel || undefined,
                        is_final: isFinal
                      });
                    }
                  }}
                  disabled={advanceRound.isPending}
                  className="w-full text-xs font-bold"
                >
                  {advanceRound.isPending ? "Memproses..." : "Lanjutkan Babak"}
                </Button>
              </div>
            );
          }
          
          if (comp.format === "knockout") {
            if (matchesList.length === 0) {
              return (
                <div className="text-center space-y-3 p-4">
                  <Trophy className="w-8 h-8 text-primary mx-auto opacity-75" />
                  <div>
                    <p className="text-xs font-bold">Generate Bracket</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Dapatkan bagan otomatis dari semua peserta yang terdaftar.</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (teamsList.length < 2) {
                        alert("Minimal 2 peserta diperlukan untuk membuat bracket.");
                        return;
                      }
                      generateBracket.mutate({
                        competition_id: comp.id,
                        teams: teamsList,
                      });
                    }}
                    disabled={generateBracket.isPending}
                    className="w-full text-xs font-bold"
                  >
                    {generateBracket.isPending ? "Memproses..." : "Generate Bracket"}
                  </Button>
                </div>
              );
            } else {
              return (
                <div className="text-center space-y-3 p-4">
                  <Trophy className="w-8 h-8 text-muted-foreground mx-auto opacity-60" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Bagan Aktif</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Seluruh pertandingan bagan sistem gugur telah aktif.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Apakah Anda yakin ingin men-generate ulang bracket? Semua skor pertandingan saat ini akan dihapus!")) {
                        generateBracket.mutate({
                          competition_id: comp.id,
                          teams: teamsList,
                        });
                      }
                    }}
                    disabled={generateBracket.isPending}
                    className="w-full text-xs font-bold hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
                  >
                    Regenerate Bracket
                  </Button>
                </div>
              );
            }
          }
          
          return null;
        };

        if (filteredMatches.length === 0 && viewMode !== "chart") {
          return (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Swords className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
                <p className="text-muted-foreground">Tidak ada pertandingan yang cocok dengan filter</p>
              </CardContent>
            </Card>
          );
        }

        if (viewMode === "chart") {
          const chartMatches = filteredMatches.filter(m => {
            if (competition.format !== "liga_grup") return true;
            return m.stage === "knockout";
          });

          return (
            <div className="space-y-4">

              <TournamentBracket
                competitionId={competition.id}
                matches={chartMatches}
                canManage={canManage}
                competitionStages={competition.stages}
                renderMatchCard={(match) => renderMatchCard(match, filteredMatches.indexOf(match))}
                createPhaseNode={renderCreatePhaseNode(competition, allTeams, matches)}
                onUpdatePhaseLabel={(roundMatches, newLabel) => {
                  roundMatches.forEach(m => {
                    updateMutation.mutate({
                      id: m.id,
                      competition_id: competition.id,
                      phase_label: newLabel || null
                    });
                  });
                }}
                onResetKnockout={() => {
                  resetKnockout.mutate({ competition_id: competition.id });
                }}
                onRegenerateKnockout={() => {
                  const advance = competition.advance_per_group || 2;
                  const groupNamesSet = Array.from(new Set(allTeams.filter(t => !!t.group_name).map(t => t.group_name!))).sort();
                  const standingsByGroup: Record<string, any[]> = {};
                  groupNamesSet.forEach((g) => {
                    standingsByGroup[g] = computeStandings(allTeams, matches, g);
                  });
                  const pairs = seedKnockoutFromStandings(standingsByGroup, advance);
                  generateKnockout.mutate({
                    competition_id: competition.id,
                    pairs,
                    match_datetime: competition.events?.event_date
                      ? `${competition.events.event_date.split("T")[0]}T${competition.events.event_time || "08:00"}`
                      : null,
                    location: competition.events?.location || null,
                    stages: competition.stages || []
                  });
                }}
                onReorderPhases={(updates) => {
                  updates.forEach((u) => {
                    updateMutation.mutate({
                      id: u.id,
                      competition_id: competition.id,
                      round_number: u.round_number
                    });
                  });
                }}
                onAddPhase={(phaseLabel) => {
                  const maxRound = chartMatches.reduce((max, m) => Math.max(max, m.round_number || 1), 0);
                  createMatch.mutate({
                    competition_id: competition.id,
                    round_number: maxRound + 1,
                    phase_label: phaseLabel,
                    match_number: 1,
                    stage: "knockout"
                  });
                }}
                onDeleteMatch={(matchId) => {
                  deleteMatch.mutate({ id: matchId, competition_id: competition.id });
                }}
                onDeletePhase={(matchIds) => {
                  matchIds.forEach(matchId => {
                    deleteMatch.mutate({ id: matchId, competition_id: competition.id });
                  });
                }}
                onAddMatch={(roundNumber, phaseLabel) => {
                  const roundMatches = chartMatches.filter(m => m.round_number === roundNumber);
                  const maxMatchNum = roundMatches.reduce((max, m) => Math.max(max, m.match_number || 0), 0);
                  createMatch.mutate({
                    competition_id: competition.id,
                    round_number: roundNumber,
                    match_number: maxMatchNum + 1,
                    phase_label: phaseLabel,
                    stage: "knockout"
                  });
                }}
              />
            </div>
          );
        }

        const sortedPhaseEntries = Object.entries(matchesByPhase).sort(([phaseA, ma], [phaseB, mb]) => {
          const ta = Math.min(...ma.map(timeOf).filter(t => t > 0));
          const tb = Math.min(...mb.map(timeOf).filter(t => t > 0));
          if (isFinite(ta) && isFinite(tb) && ta !== tb) return ta - tb;
          
          const minRoundA = Math.min(...ma.map(m => m.round_number || 1));
          const minRoundB = Math.min(...mb.map(m => m.round_number || 1));
          return minRoundA - minRoundB;
        });

        return sortedPhaseEntries.map(([phaseName, phaseMatches], phaseIdx) => (
          <div key={phaseName} className="space-y-3">
            <h4 className="font-semibold text-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2 sm:border-none sm:pb-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg">{phaseName}</span>
                <Badge variant="outline" className="font-normal text-xs whitespace-nowrap">{phaseMatches.length} pertandingan</Badge>
              </div>
              <div className="flex items-center gap-1.5 justify-end w-full sm:w-auto">
                {/* Phase actions menu — rendered only on first round header */}
                {phaseIdx === 0 && headerActions && (
                  <div className="relative z-10">{headerActions}</div>
                )}
                {canManage && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-primary px-2"
                    onClick={() => {
                      const firstMatch = phaseMatches[0];
                      const newLabel = window.prompt("Ubah Label Pertandingan/Babak (kosongkan untuk kembali ke default):", firstMatch.phase_label || "");
                      if (newLabel !== null) {
                        // Bulk update all matches in this round
                        phaseMatches.forEach(m => {
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
                    <span>Ubah Nama</span>
                  </Button>
                )}
              </div>
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              {phaseMatches.map((match, index) => renderMatchCard(match, index))}
            </div>
          </div>
        ));
      })()}

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
        canManage={canManage}
        onEditMatch={(m) => {
          setEditingMatch(m);
          setLiveScoringMatch(null);
        }}
      />

      <LiveScoreDialog 
        open={!!viewingMatch} 
        onOpenChange={(open) => !open && setViewingMatch(null)}
        match={viewingMatch}
        competition={competition}
        readOnly={true}
        canManage={canManage}
        onEditMatch={(m) => {
          setEditingMatch(m);
          setViewingMatch(null);
        }}
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
            competitionId={competition.id}
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

      {/* Spin Wheel per-team */}
      {spinningMatchContext && (
        <SpinWheelDialog
          open={!!spinningMatchContext}
          onOpenChange={(open) => !open && setSpinningMatchContext(null)}
          teams={allTeams.filter(t => t.id !== (spinningMatchContext.teamPosition === 1 ? spinningMatchContext.match.team2_id : spinningMatchContext.match.team1_id))}
          competitionId={competition.id}
          targetCount={1}
          allowTargetEdit={false}
          applying={updateMutation.isPending}
          title={`Spin Wheel — Tim ${spinningMatchContext.teamPosition}`}
          description="Putar untuk memilih tim secara acak."
          onApply={(picked) => {
            if (picked.length > 0) {
              const newTeamId = picked[0];
              const match = spinningMatchContext.match;
              const team1Id = spinningMatchContext.teamPosition === 1 ? newTeamId : match.team1_id;
              const team2Id = spinningMatchContext.teamPosition === 2 ? newTeamId : match.team2_id;
              
              updateMutation.mutate({
                id: match.id,
                competition_id: competition.id,
                team1_id: spinningMatchContext.teamPosition === 1 ? newTeamId : undefined,
                team2_id: spinningMatchContext.teamPosition === 2 ? newTeamId : undefined,
                team_ids: [team1Id, team2Id].filter(Boolean) as string[]
              }, { onSuccess: () => setSpinningMatchContext(null) });
            }
          }}
        />
      )}

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

      <AssignRefereeDialog
        open={!!pendingStartMatchId}
        onOpenChange={(open) => {
          if (!open) setPendingStartMatchId(null);
        }}
        competition={competition}
        title="Tentukan Wasit Dulu"
        description="Belum ada wasit di kompetisi ini. Tambahkan wasit terlebih dahulu sebelum memulai pertandingan."
        onAssigned={() => {
          const id = pendingStartMatchId;
          setPendingStartMatchId(null);
          if (id) {
            updateMutation.mutate({
              id,
              competition_id: competition.id,
              status: "ongoing",
            });
          }
        }}
      />
    </div>
  );
}
