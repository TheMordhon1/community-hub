import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers, CompetitionMatchWithTeams } from "@/types/competition";
import { computeStandings, GROUP_LETTERS, seedKnockoutFromStandings, hasKnockoutMatches, StandingRow } from "@/lib/liga-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users } from "lucide-react";
import { parseMemberName, capitalizeName } from "@/lib/utils";
import { extractFlagAndName, getTeamFlag } from "@/lib/countries";
import { TeamFlag } from "./TeamFlag";
import { EditTeamDialog } from "./EditTeamDialog";
import { useUpdateCompetition, useResetMatch, useUpdateTeamPhase, useSaveCompetitionStages, useGenerateKnockoutFromGroups } from "@/hooks/useCompetitions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Edit, RotateCcw, Settings2, GripVertical, Trash2, Plus, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import LiveScoreDialog from "@/components/competitions/LiveScoreDialog";
import { UpdateMatchDialog } from "@/components/competitions/UpdateMatchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
interface Props {
  competition: EventCompetitionWithDetails;
  canManage?: boolean;
}

type MemberWithHouse = {
  id: string;
  name?: string | null;
  profile?: {
    full_name: string | null;
    house?: { block: string; number: string };
  };
};



// Unified click+hover popover for team member list
function TeamNameWithMembers({
  team,
}: {
  team: {
    id: string;
    name: string;
    members?: MemberWithHouse[];
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          {team.name}
          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[160px] p-3"
        side="top"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="text-xs font-semibold mb-2 text-foreground">Anggota Tim:</div>
        <ul className="space-y-1.5">
          {team.members?.map((m) => {
            const parsed = parseMemberName(m.name);
            const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Peserta");
            const house = m.profile?.house;
            return (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>{name}</span>
                {house && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded font-mono">
                    {house.block}.{house.number}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}




const formatMatchDateTime = (dateTimeStr: string | null | undefined) => {
  if (!dateTimeStr) return "Waktu belum ditentukan";
  try {
    const dt = new Date(dateTimeStr);
    return dt.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return dateTimeStr;
  }
};

interface MatchOutcomeCircleProps {
  outcome: "W" | "L" | "D" | "E";
  match: CompetitionMatchWithTeams | null;
  currentTeamId: string;
  allTeams: CompetitionTeamWithMembers[];
  canManage?: boolean;
  competitionId?: string;
  onSelectScore?: (match: CompetitionMatchWithTeams) => void;
  onSelectUpdate?: (match: CompetitionMatchWithTeams) => void;
}

function MatchOutcomeCircle({
  outcome,
  match,
  currentTeamId,
  allTeams,
  canManage = false,
  competitionId,
  onSelectScore,
  onSelectUpdate,
}: MatchOutcomeCircleProps) {
  const [open, setOpen] = useState(false);
  const resetMutation = useResetMatch();
  
  if (outcome === "E" && !match) {
    return (
      <div className="w-5 h-5 rounded-full border border-muted-foreground/30 bg-transparent shrink-0" />
    );
  }

  // Find opponent
  const opponentId = match.team1_id === currentTeamId ? match.team2_id : match.team1_id;
  const opponent = allTeams.find(t => t.id === opponentId);
  const opponentName = opponent ? opponent.name : "Tim Lain";
  const { name: opponentCleanName } = extractFlagAndName(opponentName);

  let title = "";
  let badgeClass = "";
  let icon = "";

  if (outcome === "W") {
    title = `Menang vs ${opponentCleanName}`;
    badgeClass = "bg-emerald-500 text-white";
    icon = "✓";
  } else if (outcome === "L") {
    title = `Kalah vs ${opponentCleanName}`;
    badgeClass = "bg-rose-500 text-white";
    icon = "✗";
  } else if (outcome === "D") {
    title = `Seri vs ${opponentCleanName}`;
    badgeClass = "bg-amber-500 text-white";
    icon = "−";
  } else {
    // Outcome is "E", but we have a match object. That means it is a future scheduled match.
    title = `Akan Datang vs ${opponentCleanName}`;
    badgeClass = "bg-muted text-muted-foreground hover:bg-muted/80 border border-muted-foreground/25";
    icon = "";
  }

  const dateTimeFormatted = formatMatchDateTime(match.match_datetime);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer transition-all hover:scale-110 focus:outline-none ${badgeClass}`}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 z-50 text-xs shadow-md border bg-popover text-popover-foreground"
        side="top"
        align="center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-1">
          <div className="font-semibold text-foreground">{title}</div>
          {match.status === "completed" && (
            <div className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded inline-block">
              Skor: {match.score1} - {match.score2}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground pt-1 border-t">
            {dateTimeFormatted}
          </div>

          {canManage && (
            <div className="flex flex-col gap-1.5 pt-2 mt-2 border-t border-border/40">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[10px] h-7 font-bold gap-1 justify-start cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectScore) onSelectScore(match);
                  setOpen(false);
                }}
              >
                <Play className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                Atur Skor / Main
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                className="w-full text-[10px] h-7 font-bold gap-1 justify-start cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectUpdate) onSelectUpdate(match);
                  setOpen(false);
                }}
              >
                <Edit className="w-3 h-3 text-blue-500" />
                Ubah Detail
              </Button>

              {match.status === "completed" && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full text-[10px] h-7 font-bold gap-1 justify-start bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/20 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Apakah Anda yakin ingin membatalkan/reset pertandingan ini? Skor akan dihapus dan kembali ke terjadwal.")) {
                      resetMutation.mutate({
                        id: match.id,
                        competition_id: competitionId || ""
                      });
                      setOpen(false);
                    }
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  Batalkan Pertandingan
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TeamPhasePopover({ team, competition, onUpdate, isUpdating }: { 
  team: CompetitionTeamWithMembers; 
  competition: EventCompetitionWithDetails; 
  onUpdate: (teamId: string, type: string, label: string) => void;
  isUpdating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(team.next_stage_type || "knockout");
  const [label, setLabel] = useState(team.next_stage_label || "Quarter Final");
  const [isConfirming, setIsConfirming] = useState(false);

  const settings = competition.kids_brackets as unknown as Record<string, unknown> || {};
  const stageTypes = (settings.__stage_types as Record<string, string>) || {};

  const handleSelectLabel = (val: string) => {
    setLabel(val);
    if (stageTypes[val]) {
      setType(stageTypes[val]);
    }
  };

  return (
    <Popover 
      open={open} 
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          setType(team.next_stage_type || "knockout");
          setLabel(team.next_stage_label || "Quarter Final");
          setIsConfirming(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
          title="Atur Fase Selanjutnya"
        >
          <Medal className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[9px] font-bold hidden sm:inline whitespace-nowrap">
            {team.next_stage_label || "Lolos"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 z-50">
        <div className="space-y-3">
          <h4 className="font-bold text-xs">Atur Fase Selanjutnya</h4>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground">Tipe Stage</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="knockout">Babak Gugur (Knockout)</SelectItem>
                <SelectItem value="playoff">Playoff Grup</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-muted-foreground">Nama Fase/Grup</label>
            {type === "knockout" ? (
              <Select value={label} onValueChange={handleSelectLabel}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {competition.stages && competition.stages.filter(s => (stageTypes[s.name] || "knockout") === "knockout").length > 0 ? (
                    competition.stages.filter(s => (stageTypes[s.name] || "knockout") === "knockout").map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="Final">Final</SelectItem>
                      <SelectItem value="Semi Final">Semi Final</SelectItem>
                      <SelectItem value="Quarter Final">Quarter Final</SelectItem>
                      <SelectItem value="Babak 16 Besar">Babak 16 Besar</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Select value={competition.stages?.some(s => s.name === label) ? label : ""} onValueChange={handleSelectLabel}>
                  <SelectTrigger className="h-8 text-xs bg-muted/30">
                    <SelectValue placeholder="Pilih fase yang sudah ada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {competition.stages?.filter(s => stageTypes[s.name] === "playoff").length ? (
                      competition.stages.filter(s => stageTypes[s.name] === "playoff").map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-[10px] text-muted-foreground text-center italic">Belum ada grup yang disimpan</div>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="text-[9px] text-muted-foreground font-semibold">ATAU KETIK BARU</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>
                <Input 
                  value={label} 
                  onChange={(e) => setLabel(e.target.value)} 
                  placeholder="Misal: Playoff Grup A" 
                  className="h-8 text-xs" 
                />
              </div>
            )}
          </div>
          {!isConfirming ? (
            <Button 
              size="sm" 
              className="w-full h-8 text-xs font-bold" 
              onClick={() => setIsConfirming(true)}
              disabled={isUpdating}
            >
              Simpan
            </Button>
          ) : (
            <div className="pt-2 border-t space-y-2 mt-2">
              <p className="text-[10px] text-muted-foreground leading-tight">
                Review: Tim ini akan dimasukkan ke fase <strong>{label}</strong> ({type === 'knockout' ? 'Knockout' : 'Playoff'}). Apakah Anda yakin?
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="flex-1 h-7 text-[10px]" 
                  onClick={() => setIsConfirming(false)}
                >
                  Batal
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1 h-7 text-[10px] font-bold" 
                  onClick={() => {
                    onUpdate(team.id, type, label);
                    setOpen(false);
                  }}
                  disabled={isUpdating}
                >
                  Konfirmasi
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GroupStandings({ competition, canManage = false }: Props) {
  const teams = competition.teams || [];
  const matches = competition.matches || [];
  const advance = competition.advance_per_group ?? 2;
  const [showFlags, setShowFlags] = useState(true);
  const [editingTeam, setEditingTeam] = useState<CompetitionTeamWithMembers | null>(null);

  const [selectedMatchForScore, setSelectedMatchForScore] = useState<CompetitionMatchWithTeams | null>(null);
  const [selectedMatchForUpdate, setSelectedMatchForUpdate] = useState<CompetitionMatchWithTeams | null>(null);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  const [isStageManagerOpen, setIsStageManagerOpen] = useState(false);
  const [localStages, setLocalStages] = useState<{ id?: string; name: string; order_number: number; type: string }[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newStageType, setNewStageType] = useState("knockout");

  const updateCompetition = useUpdateCompetition();
  const updateTeamPhase = useUpdateTeamPhase();
  const saveCompetitionStages = useSaveCompetitionStages();
  const generateKnockout = useGenerateKnockoutFromGroups();

  const [generateKnockoutOpen, setGenerateKnockoutOpen] = useState(false);
  const [selectedQualifiers, setSelectedQualifiers] = useState<Record<string, string[]>>({});

  const openGenerateKnockout = () => {
    const initial: Record<string, string[]> = {};
    allGroups.forEach(groupData => {
      const { name: g, isPlayoff } = groupData;
      const rows = computeStandings(teams, matches, g, isPlayoff);
      let groupAdvanceCount = (competition.kids_brackets as unknown as Record<string, number> | null)?.[g] ?? competition.advance_per_group ?? 2;
      if (!isPlayoff) {
        const playoffTeamsCount = teams.filter(t => t.group_name === g && t.next_stage_type === "playoff").length;
        groupAdvanceCount = Math.max(0, groupAdvanceCount - playoffTeamsCount);
      }
      const availableRows = isPlayoff ? rows : rows.filter(r => r.team.next_stage_type !== "playoff");
      initial[g] = availableRows.slice(0, groupAdvanceCount).map(r => r.team.id);
    });
    setSelectedQualifiers(initial);
    setGenerateKnockoutOpen(true);
  };

  const handleGenerateKnockout = () => {
    const fakeStandings: Record<string, StandingRow[]> = {};
    for (const [g, teamIds] of Object.entries(selectedQualifiers)) {
      fakeStandings[g] = teamIds.map((tid) => ({
        played: 1,
        team: { id: tid }
      } as StandingRow));
    }

    const advanceMap: Record<string, number> = {};
    allGroups.forEach(groupData => {
      const { name: g, isPlayoff } = groupData;
      let groupAdvanceCount = (competition.kids_brackets as unknown as Record<string, number> | null)?.[g] ?? competition.advance_per_group ?? 2;
      if (!isPlayoff) {
        const playoffTeamsCount = teams.filter(t => t.group_name === g && t.next_stage_type === "playoff").length;
        groupAdvanceCount = Math.max(0, groupAdvanceCount - playoffTeamsCount);
      }
      advanceMap[g] = groupAdvanceCount;
    });

    const pairs = seedKnockoutFromStandings(fakeStandings as Record<string, StandingRow[]>, advanceMap);
    
    generateKnockout.mutate({
      competition_id: competition.id,
      pairs,
      stages: competition.stages || []
    }, {
      onSuccess: () => {
        setGenerateKnockoutOpen(false);
      }
    });
  };

  const openStageManager = () => {
    // default to empty or the saved stages
    const currentStages = competition.stages || [];
    const settings = competition.kids_brackets as unknown as Record<string, unknown> || {};
    const stageTypes = (settings.__stage_types as Record<string, string>) || {};
    
    setLocalStages(currentStages.map(s => ({ 
      id: s.id, 
      name: s.name, 
      order_number: s.order_number,
      type: stageTypes[s.name] || "knockout"
    })));
    setIsStageManagerOpen(true);
  };

  const handleSaveStages = () => {
    const settings = { ...(competition.kids_brackets as unknown as Record<string, unknown> || {}) };
    const newStageTypes: Record<string, string> = {};
    localStages.forEach(s => {
      newStageTypes[s.name] = s.type;
    });
    settings.__stage_types = newStageTypes;

    updateCompetition.mutate({
      id: competition.id,
      event_id: competition.event_id,
      kids_brackets: settings as unknown as { min: number; max: number; label?: string }[],
    });

    saveCompetitionStages.mutate({
      competition_id: competition.id,
      stages: localStages.map((s, idx) => ({ name: s.name, order_number: idx + 1 })),
    });
    setIsStageManagerOpen(false);
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= localStages.length) return;
    const updated = [...localStages];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    setLocalStages(updated);
  };

  const handleUpdatePhase = (teamId: string, next_stage_type: string, next_stage_label: string) => {
    updateTeamPhase.mutate({
      id: teamId,
      competition_id: competition.id,
      next_stage_type,
      next_stage_label,
    });
  };

  const handleSetGroupAdvance = (groupName: string, count: number | null) => {
    const currentSettings = { ...(competition.kids_brackets as unknown as Record<string, number> || {}) };
    
    if (count === null) {
      delete currentSettings[groupName];
    } else {
      currentSettings[groupName] = count;
    }

    updateCompetition.mutate({
      id: competition.id,
      event_id: competition.event_id,
      kids_brackets: currentSettings as unknown as { min: number; max: number; label?: string }[],
    });
  };

  const normalGroups = Array.from(
    new Set(teams.map((t) => t.group_name).filter((g): g is string => !!g))
  ).sort();

  const playoffGroups = Array.from(
    new Set(
      teams
        .filter((t) => t.next_stage_type === "playoff" && t.next_stage_label)
        .map((t) => t.next_stage_label as string)
    )
  ).sort();

  const allGroups = [
    ...normalGroups.map(g => ({ name: g, isPlayoff: false, title: `Grup ${g}` })),
    ...playoffGroups.map(p => ({ name: p, isPlayoff: true, title: p }))
  ];

  if (allGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Belum ada peserta yang diassign ke grup. Buka tab Peserta untuk membagi ke Grup{" "}
          {GROUP_LETTERS.slice(0, competition.group_count ?? 3).join(", ")}.
        </CardContent>
      </Card>
    );
  }

  const gridColsClass = 
    allGroups.length === 1 
      ? "grid-cols-1" 
      : allGroups.length === 2 
        ? "grid-cols-1 md:grid-cols-2" 
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      <div className="flex flex-wrap items-center justify-end mb-4 gap-2 w-full">
        {canManage && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs font-bold gap-1.5 flex-1 sm:flex-none whitespace-nowrap"
              onClick={openStageManager}
            >
              <Settings2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Pengaturan Stage</span>
              <span className="sm:hidden">Pengaturan</span>
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="h-8 text-xs font-bold gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground flex-1 sm:flex-none whitespace-nowrap"
              onClick={openGenerateKnockout}
            >
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Generate Knockout Stage</span>
              <span className="sm:hidden">Gen Knockout</span>
            </Button>
          </>
        )}
        <label className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-muted/70 transition-colors w-full sm:w-auto">
          <input
            type="checkbox"
            checked={showFlags}
            onChange={(e) => setShowFlags(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
          />
          Tampilkan Bendera Tim
        </label>
      </div>
      <div className={`grid gap-4 w-full min-w-0 ${gridColsClass}`}>
        {allGroups.map((groupData) => {
          const { name: g, isPlayoff, title } = groupData;
          const rows = computeStandings(teams, matches, g, isPlayoff);
          
          const groupTeamsCount = teams.filter((t) => 
            isPlayoff 
              ? t.next_stage_type === "playoff" && t.next_stage_label === g
              : t.group_name === g
          ).length;
          const maxGroupMatches = Math.max(1, groupTeamsCount - 1);
          const customAdvance = (competition.kids_brackets as unknown as Record<string, number> | null)?.[g];
          const groupAdvanceCount = customAdvance ?? competition.advance_per_group ?? 2;

          return (
            <Card key={`group-${isPlayoff ? 'playoff' : 'normal'}-${g}`} className="w-full min-w-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px] font-bold text-foreground">Tim</TableHead>
                        <TableHead className="text-center w-8 px-1" title="Main">
                          G
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Menang">
                          W
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Kalah">
                          L
                        </TableHead>
                        <TableHead className="text-center w-12 px-1 font-bold">Poin</TableHead>
                        <TableHead className="text-center w-28 px-1 whitespace-nowrap">{maxGroupMatches} Game</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => {
                        const advancing = idx < groupAdvanceCount;
                        const { flag, name: cleanName } = extractFlagAndName(r.team.name);
                        const teamFlagEmoji = getTeamFlag(r.team);

                        const membersWithHouse = r.team.members?.map((m) => {
                          const parsed = parseMemberName(m.name);
                          const profile = m.profile as { full_name?: string | null; house?: { block: string; number: string }; avatar_url?: string | null } | undefined;
                          const name = capitalizeName(profile?.full_name?.trim() || parsed.name || "Pemain");
                          const house = profile?.house || 
                            (m.house_block && m.house_number ? { block: m.house_block, number: m.house_number } : null);
                          return { id: m.id, name, house, avatar_url: parsed.avatarUrl || r.team.logo_url || profile?.avatar_url };
                        }) || [];
                        const hasMembers = membersWithHouse.length > 0;

                        // All matches for this team in this group stage, completed or scheduled
                        const teamGroupMatches = matches.filter((m) => {
                          return m.stage === "group" &&
                                 m.group_name === g &&
                                 (m.team1_id === r.team.id || m.team2_id === r.team.id);
                        });

                        const sortedTeamGroupMatches = [...teamGroupMatches].sort((a, b) => {
                          if (!a.match_datetime) return 1;
                          if (!b.match_datetime) return -1;
                          return new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
                        });

                        // Create exactly maxGroupMatches slots corresponding to W/L/D outcomes or scheduled match details
                        const historySlots = Array.from({ length: maxGroupMatches }, (_, i) => {
                          const match = sortedTeamGroupMatches[i] || null;
                          let outcome: "W" | "L" | "D" | "E" = "E";
                          if (match && match.status === "completed") {
                            const isTeam1 = match.team1_id === r.team.id;
                            const s1 = parseInt(match.score1 || "0", 10);
                            const s2 = parseInt(match.score2 || "0", 10);
                            if (s1 === s2) outcome = "D";
                            else if (isTeam1) {
                              outcome = s1 > s2 ? "W" : "L";
                            } else {
                              outcome = s2 > s1 ? "W" : "L";
                            }
                          }
                          return { outcome, match };
                        });

                        return (
                          <TableRow key={r.team.id} className={advancing ? "bg-primary/5" : ""}>
                            <TableCell className="font-medium py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-4 flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                {showFlags && (
                                  <TeamFlag team={r.team} />
                                )}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {canManage ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditingTeam(r.team)}
                                        className="hover:underline hover:text-primary font-bold cursor-pointer text-left transition-colors truncate max-w-[140px] sm:max-w-[180px]"
                                      >
                                        {cleanName}
                                      </button>
                                    ) : (
                                      <span className="truncate max-w-[140px] sm:max-w-[180px]" title={cleanName}>
                                        {cleanName}
                                      </span>
                                    )}
                                    {advancing && r.played >= maxGroupMatches && (
                                      isPlayoff ? (
                                        <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded cursor-default" title="Target Fase Lanjutan">
                                          <Medal className="w-3.5 h-3.5 shrink-0" />
                                          <span className="text-[9px] font-bold hidden sm:inline whitespace-nowrap">
                                            {g.toLowerCase().includes(' to ') ? g.replace(/^.* to /i, '') : "Lolos"}
                                          </span>
                                        </div>
                                      ) : canManage ? (
                                        <TeamPhasePopover 
                                          team={r.team} 
                                          competition={competition} 
                                          onUpdate={handleUpdatePhase}
                                          isUpdating={updateTeamPhase.isPending} 
                                        />
                                      ) : (
                                        <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-600 px-1.5 py-0.5 rounded cursor-default" title={r.team.next_stage_label || "Lolos Grup"}>
                                          <Medal className="w-3.5 h-3.5 shrink-0" />
                                          {r.team.next_stage_label && (
                                            <span className="text-[9px] font-bold hidden sm:inline whitespace-nowrap">{r.team.next_stage_label}</span>
                                          )}
                                        </div>
                                      )
                                    )}
                                  </div>
                                  {hasMembers && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[200px] sm:max-w-[240px]">
                                      {membersWithHouse.map((m) => {
                                        const initial = m.name.charAt(0).toUpperCase();
                                        return (
                                          <div key={m.id} className="flex items-center gap-1.5 bg-background/60 px-1.5 py-0.5 rounded-full border border-border/40 shadow-sm" title={m.house ? `${m.name} (${m.house.block}.${m.house.number})` : m.name}>
                                            <Avatar className="w-3.5 h-3.5 border border-primary/20 shrink-0">
                                              <AvatarImage src={m.avatar_url || ""} />
                                              <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initial}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-[9px] font-semibold text-foreground truncate max-w-[80px]">{m.name}</span>
                                            {m.house && (
                                              <span className="text-[8px] text-muted-foreground/80 font-mono ml-0.5 bg-muted px-0.5 py-0.25 rounded shrink-0 select-none">
                                                {m.house.block}.{m.house.number}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center px-1 py-3">{r.played}</TableCell>
                            <TableCell className="text-center px-1 py-3">{r.wins}</TableCell>
                            <TableCell className="text-center px-1 py-3">{r.losses}</TableCell>
                            <TableCell className="text-center px-1 py-3 font-bold">
                              {r.points}
                            </TableCell>
                            <TableCell className="px-1 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {historySlots.map((slot, oIdx) => (
                                  <MatchOutcomeCircle
                                    key={oIdx}
                                    outcome={slot.outcome}
                                    match={slot.match}
                                    currentTeamId={r.team.id}
                                    allTeams={teams}
                                    canManage={canManage}
                                    competitionId={competition.id}
                                    onSelectScore={(match) => {
                                      setSelectedMatchForScore(match);
                                      setScoreDialogOpen(true);
                                    }}
                                    onSelectUpdate={(match) => {
                                      setSelectedMatchForUpdate(match);
                                      setUpdateDialogOpen(true);
                                    }}
                                  />
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    Menang set = 1 poin, Top {groupAdvanceCount} tim lolos
                  </p>
                  {canManage && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                      <span>Lolos:</span>
                      <select
                        value={customAdvance ?? "default"}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleSetGroupAdvance(g, val === "default" ? null : parseInt(val));
                        }}
                        className="bg-background border rounded px-1.5 py-0.5 font-semibold text-foreground focus:ring-1 focus:ring-primary text-[10px] outline-none"
                      >
                        <option value="default">Default ({competition.advance_per_group ?? 2})</option>
                        {Array.from({ length: Math.max(1, groupTeamsCount) }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>{num} Tim</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingTeam && (
        <EditTeamDialog
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          team={editingTeam}
          competition={competition}
        />
      )}

      <UpdateMatchDialog
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        match={selectedMatchForUpdate}
        competition={competition}
      />

      <LiveScoreDialog
        open={scoreDialogOpen}
        onOpenChange={setScoreDialogOpen}
        match={selectedMatchForScore}
        competition={competition}
        canManage={canManage}
        onEditMatch={(m) => {
          setSelectedMatchForUpdate(m);
          setUpdateDialogOpen(true);
          setScoreDialogOpen(false);
        }}
      />

      <Dialog open={isStageManagerOpen} onOpenChange={(open) => { setIsStageManagerOpen(open); if (!open) setNewStageName(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Kelola Fase Lanjutan
            </DialogTitle>
            <DialogDescription>
              Atur urutan fase lanjutan dari atas (puncak/final) ke bawah.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {localStages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">Belum ada fase khusus. Tambahkan di bawah.</p>
            )}
            {localStages.map((stage, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors shadow-sm"
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-2">
                  <span className="text-sm font-semibold truncate">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Urutan: {idx + 1}
                    </span>
                    <Select 
                      value={stage.type} 
                      onValueChange={(val) => {
                        const updated = [...localStages];
                        updated[idx].type = val;
                        setLocalStages(updated);
                      }}
                    >
                      <SelectTrigger className="h-5 text-[9px] w-[130px] border-none bg-muted/50 px-1.5 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knockout" className="text-[10px]">Babak Gugur (Knockout)</SelectItem>
                        <SelectItem value="playoff" className="text-[10px]">Grup / Playoff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    disabled={idx === 0}
                    onClick={() => moveStage(idx, "up")}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    disabled={idx === localStages.length - 1}
                    onClick={() => moveStage(idx, "down")}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setLocalStages(prev => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Select value={newStageType} onValueChange={setNewStageType}>
                <SelectTrigger className="h-9 text-xs w-[180px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="knockout">Babak Gugur</SelectItem>
                  <SelectItem value="playoff">Grup / Playoff</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Nama fase (misal: Final, Grup A)"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newStageName.trim()) {
                    setLocalStages(prev => [...prev, { name: newStageName.trim(), order_number: prev.length + 1, type: newStageType }]);
                    setNewStageName("");
                  }
                }}
                className="h-9 text-sm flex-1"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-9 px-3 w-full flex items-center justify-center gap-1"
              disabled={!newStageName.trim()}
              onClick={() => {
                setLocalStages(prev => [...prev, { name: newStageName.trim(), order_number: prev.length + 1, type: newStageType }]);
                setNewStageName("");
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Fase
            </Button>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setIsStageManagerOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveStages} disabled={saveCompetitionStages.isPending || updateCompetition.isPending}>
              Simpan Urutan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateKnockoutOpen} onOpenChange={setGenerateKnockoutOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Knockout Stage</DialogTitle>
            <DialogDescription>
              Pilih tim dari masing-masing grup yang berhak maju ke babak selanjutnya. Tim-tim teratas berdasarkan perolehan poin otomatis terpilih.
            </DialogDescription>
          </DialogHeader>

          {hasKnockoutMatches(matches) && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md flex gap-3 text-sm mt-4 items-start">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>
                <strong>Peringatan:</strong> Bagan sistem gugur (knockout) sebelumnya sudah ada. Meng-generate ulang akan menghapus secara permanen seluruh pertandingan di bagan lama dan menggantinya dengan yang baru.
              </p>
            </div>
          )}

          <div className="grid gap-4 mt-4 sm:grid-cols-2">
            {allGroups.map((groupData) => {
              const { name: g, isPlayoff } = groupData;
              const rows = computeStandings(teams, matches, g, isPlayoff);
              let groupAdvanceCount = (competition.kids_brackets as unknown as Record<string, number> | null)?.[g] ?? competition.advance_per_group ?? 2;
              
              if (!isPlayoff) {
                const playoffTeamsCount = teams.filter(t => t.group_name === g && t.next_stage_type === "playoff").length;
                groupAdvanceCount = Math.max(0, groupAdvanceCount - playoffTeamsCount);
              }

              if (rows.length === 0 || groupAdvanceCount === 0) return null;
              
              const availableRows = isPlayoff ? rows : rows.filter(r => r.team.next_stage_type !== "playoff");

              return (
                <div key={`gk-${g}`} className="border rounded-md p-3 space-y-3 bg-muted/20">
                  <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" /> Grup {g}
                  </h4>
                  {Array.from({ length: groupAdvanceCount }).map((_, idx) => {
                    const rankLabel = idx === 0 ? "Juara 1" : idx === 1 ? "Runner Up" : `Peringkat ${idx + 1}`;
                    const currentSelection = selectedQualifiers[g]?.[idx] || "";

                    return (
                      <div key={idx} className="space-y-1.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{rankLabel}</label>
                        <Select 
                          value={currentSelection} 
                          onValueChange={(val) => {
                            setSelectedQualifiers(prev => {
                              const newArr = [...(prev[g] || [])];
                              newArr[idx] = val;
                              return { ...prev, [g]: newArr };
                            });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue placeholder="Pilih Tim" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRows.map(r => (
                              <SelectItem key={r.team.id} value={r.team.id}>
                                {r.team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setGenerateKnockoutOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleGenerateKnockout} disabled={generateKnockout.isPending}>
              {generateKnockout.isPending ? "Generating..." : "Generate Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
