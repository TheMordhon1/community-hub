import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users, Sparkles, Shuffle, MousePointerClick, Swords, Calendar, Clock } from "lucide-react";
import { useCreateMatch } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { SpinWheelDialog } from "@/components/competitions/SpinWheelDialog";
import { useAssignMatchTeams } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails, CompetitionMatchWithTeams, CompetitionTeamWithMembers } from "@/types/competition";
import { computeStandings } from "@/lib/liga-group";
import { parseMemberName, capitalizeName, cn } from "@/lib/utils";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { extractFlagAndName } from "@/lib/countries";
import { findBracket, formatBracket, isAgeInBracket, type AgeBracket } from "@/lib/age-groups";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

type SelectionMode = "manual" | "random" | "spin" | "later";

export function CreateMatchDialog({
  open,
  onOpenChange,
  competition,
}: CreateMatchDialogProps) {
  const { toast } = useToast();
  const [roundNumber, setRoundNumber] = useState("1");
  const [matchNumber, setMatchNumber] = useState("1");
  const [team1Id, setTeam1Id] = useState<string>("");
  const [team2Id, setTeam2Id] = useState<string>("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [matchDatetime, setMatchDatetime] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  });
  const [location, setLocation] = useState("Lapangan Badminton PKT");
  const [maxParticipants, setMaxParticipants] = useState<string>("2");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("manual");
  const [spinFor, setSpinFor] = useState<{ matchId: string; target: number } | null>(null);
  const [bracketMin, setBracketMin] = useState("");
  const [bracketMax, setBracketMax] = useState("");
  const [bracketLabel, setBracketLabel] = useState("");

  // Simplified Match Stage/Phase States
  const [stageType, setStageType] = useState<"group" | "playoff" | "knockout">("knockout");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [groupName, setGroupName] = useState("");
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomGroup, setIsCustomGroup] = useState(false);

  const is17an = competition.format === "17an";
  const isTeamMatchFormat = competition.match_type && competition.match_type !== "1v1";
  const allTeams = competition.teams || [];
  const isLigaGrup = competition.format === "liga_grup";

  // Predefined lists for selection dropdowns
  const groupNameOptions = useMemo(() => {
    if (stageType === "group") {
      const normal = Array.from(
        new Set(
          allTeams
            .filter((t) => !!t.group_name)
            .map((t) => t.group_name!)
        )
      ).sort();
      return normal.length > 0 ? normal : ["A", "B", "C", "D"];
    }
    if (stageType === "playoff") {
      return Array.from(
        new Set(
          allTeams
            .filter((t) => t.next_stage_type === "playoff" && t.next_stage_label)
            .map((t) => t.next_stage_label!)
        )
      ).sort();
    }
    return [];
  }, [stageType, allTeams]);

  const phaseLabelOptions = useMemo(() => {
    const labels = new Set<string>();
    
    if (competition.stages && competition.stages.length > 0) {
      competition.stages.forEach(s => {
        if (s.name) labels.add(s.name);
      });
    }
    
    if (competition.matches && competition.matches.length > 0) {
      competition.matches.forEach(m => {
        if (m.phase_label) labels.add(m.phase_label);
      });
    }
    
    const defaults = ["Group Stage", "Babak Penyisihan", "Babak 16 Besar", "Perempat Final", "Semi Final", "Final"];
    defaults.forEach(d => labels.add(d));
    
    return Array.from(labels);
  }, [competition.stages, competition.matches]);

  // Teams eligible for selection.
  // - Group stage: restrict to selected group
  // - Playoff group stage: restrict to teams advanced to this playoff group
  // - Knockout stage / any phase: restrict to teams advanced to this specific phase
  const eligibleTeams = useMemo(() => {
    // 1. Group Stage
    if (stageType === "group" && groupName) {
      return allTeams.filter((t) => t.group_name === groupName);
    }
    
    // 2. Playoff Group Stage
    if (stageType === "playoff" && groupName) {
      const playoffTeams = allTeams.filter(
        (t) => t.next_stage_type === "playoff" && t.next_stage_label === groupName
      );
      if (playoffTeams.length > 0) return playoffTeams;
      return allTeams;
    }
    
    // 3. Knockout / Custom Phase
    if (stageType === "knockout") {
      if (phaseLabel) {
        const advancedTeams = allTeams.filter(
          (t) => t.next_stage_type === "knockout" && t.next_stage_label === phaseLabel
        );
        if (advancedTeams.length > 0) return advancedTeams;
        
        const matchingLabelTeams = allTeams.filter(
          (t) => t.next_stage_label === phaseLabel
        );
        if (matchingLabelTeams.length > 0) return matchingLabelTeams;
      }
      
      // Fallback for Liga Grup format specifically (calculate qualified from group standings)
      if (isLigaGrup) {
        const groupNames = Array.from(
          new Set(allTeams.filter((t) => !!t.group_name).map((t) => t.group_name!))
        ).sort();
        if (groupNames.length === 0) return allTeams;
        
        const advance = competition.advance_per_group || 2;
        const qualifiedIds = new Set<string>();
        for (const g of groupNames) {
          const standings = computeStandings(
            allTeams,
            competition.matches || [],
            g
          );
          for (let i = 0; i < Math.min(advance, standings.length); i++) {
            qualifiedIds.add(standings[i].team.id);
          }
        }
        if (qualifiedIds.size === 0) return allTeams;
        return allTeams.filter((t) => qualifiedIds.has(t.id));
      }
    }
    
    return allTeams;
  }, [isLigaGrup, stageType, groupName, phaseLabel, allTeams, competition.matches, competition.advance_per_group]);

  // Age brackets configured on the competition
  const competitionBrackets = useMemo<AgeBracket[]>(
    () => (Array.isArray(competition.kids_brackets) ? (competition.kids_brackets as AgeBracket[]) : []),
    [competition.kids_brackets]
  );

  // Optional age range override typed for this match
  const matchBracket = useMemo(() => {
    const min = parseFloat(bracketMin);
    const max = parseFloat(bracketMax);
    if (isNaN(min) && isNaN(max)) return null;
    return { min: isNaN(min) ? null : min, max: isNaN(max) ? null : max };
  }, [bracketMin, bracketMax]);

  // Registered participants stay reusable across matches — they are only
  // narrowed by the age range of this match (when one is set).
  const bracketedTeams = useMemo(() => {
    if (!matchBracket) return allTeams;
    return allTeams.filter(
      (t) => t.age != null && isAgeInBracket(t.age, matchBracket.min, matchBracket.max)
    );
  }, [allTeams, matchBracket]);

  // Group participants by their age bracket so selection is fair per age group
  const teamsByAgeBracket = useMemo(() => {
    const groups = new Map<string, typeof bracketedTeams>();
    for (const t of bracketedTeams) {
      let label = "Tanpa Umur";
      if (t.age != null) {
        const b = findBracket(t.age, competitionBrackets);
        label = b ? formatBracket(b) : `${t.age} thn`;
      }
      const list = groups.get(label) || [];
      list.push(t);
      groups.set(label, list);
    }
    return Array.from(groups.entries()).sort((a, b) => {
      const ageA = a[1][0]?.age ?? Infinity;
      const ageB = b[1][0]?.age ?? Infinity;
      return ageA - ageB;
    });
  }, [bracketedTeams, competitionBrackets]);

  // Pre-compute pairs that already met in group stage of the same group
  const metPairs = new Set<string>();
  if (isLigaGrup && (stageType === "group" || stageType === "playoff")) {
    for (const m of competition.matches || []) {
      if (m.stage !== "group") continue;
      if (groupName && m.group_name !== groupName) continue;
      if (!m.team1_id || !m.team2_id) continue;
      const key = [m.team1_id, m.team2_id].sort().join("|");
      metPairs.add(key);
    }
  }
  const hasMet = (a: string, b: string) =>
    !!a && !!b && a !== b && metPairs.has([a, b].sort().join("|"));

  // Same-day conflict detection: warn when selected teams already have a match on this date
  const selectedDateStr = (() => {
    if (!matchDatetime) return null;
    try {
      return format(parseISO(matchDatetime), "yyyy-MM-dd");
    } catch {
      return null;
    }
  })();

  const sameDayConflicts = useMemo(() => {
    if (!selectedDateStr) return [];
    const selectedTeamIdsSet = new Set<string>();
    if (team1Id && team1Id !== "none") selectedTeamIdsSet.add(team1Id);
    if (team2Id && team2Id !== "none") selectedTeamIdsSet.add(team2Id);
    selectedTeamIds.forEach((id) => selectedTeamIdsSet.add(id));

    const matches = competition.matches || [];
    const conflictMap = new Map<string, { teamName: string; match: CompetitionMatchWithTeams }>();

    for (const match of matches) {
      if (!match.match_datetime) continue;
      const matchDate = format(parseISO(match.match_datetime), "yyyy-MM-dd");
      if (matchDate !== selectedDateStr) continue;

      const involvedIds = [
        match.team1_id,
        match.team2_id,
        ...(match.participants?.map((p) => p.team_id) || []),
      ].filter((id): id is string => !!id);

      for (const id of involvedIds) {
        if (selectedTeamIdsSet.has(id)) {
          const teamName = allTeams.find((t) => t.id === id)?.name || "Tim";
          conflictMap.set(id, { teamName, match });
        }
      }
    }
    return Array.from(conflictMap.values());
  }, [selectedDateStr, team1Id, team2Id, selectedTeamIds, competition.matches, allTeams]);

  // Dialog Open/Close Reset and Initialization
  useEffect(() => {
    if (open) {
      setMaxParticipants(is17an ? "3" : "2");
      setSelectionMode("manual");
      
      const isGroupStageDefault = competition.format === "liga_grup";
      setStageType(isGroupStageDefault ? "group" : "knockout");
      setIsCustomPhase(false);
      setIsCustomGroup(false);

      if (isTeamMatchFormat) {
        const existingMatches = competition.matches || [];
        const nextNum = existingMatches.length > 0
          ? Math.max(...existingMatches.map(m => m.match_number || 0)) + 1
          : 1;
        setMatchNumber(String(nextNum));
        setRoundNumber("1");
        setMaxParticipants("2");
      }

      if (competition.events) {
        if (!location) setLocation(competition.events.location || "Lapangan Badminton PKT");
      }
      
      const defaultTime = (() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      })();
      setMatchDatetime(defaultTime);
    } else {
      setRoundNumber("1");
      setMatchNumber("1");
      setTeam1Id("");
      setTeam2Id("");
      setSelectedTeamIds([]);
      setMatchDatetime("");
      setLocation("Lapangan Badminton PKT");
      setMaxParticipants("2");
      setSelectionMode("manual");
      setSpinFor(null);
      setBracketMin("");
      setBracketMax("");
      setBracketLabel("");
      setStageType("knockout");
      setPhaseLabel("");
      setGroupName("");
      setIsCustomPhase(false);
      setIsCustomGroup(false);
    }
  }, [open, competition.events, competition.format, competition.match_type, is17an, isTeamMatchFormat]);

  // Stage type change handler for defaults
  useEffect(() => {
    if (!open) return;
    if (stageType === "group") {
      setPhaseLabel("Group Stage");
      setIsCustomPhase(false);
      
      const normal = allTeams.filter((t) => !!t.group_name).map((t) => t.group_name!);
      const uniqueNormal = Array.from(new Set(normal)).sort();
      if (uniqueNormal.length > 0) {
        setGroupName(uniqueNormal[0]);
        setIsCustomGroup(false);
      } else {
        setGroupName("A");
        setIsCustomGroup(true);
      }
    } else if (stageType === "playoff") {
      setPhaseLabel("Playoff");
      setIsCustomPhase(false);
      
      const playoff = allTeams.filter((t) => t.next_stage_type === "playoff" && t.next_stage_label).map((t) => t.next_stage_label!);
      const uniquePlayoff = Array.from(new Set(playoff)).sort();
      if (uniquePlayoff.length > 0) {
        setGroupName(uniquePlayoff[0]);
        setIsCustomGroup(false);
      } else {
        setGroupName("Playoff Grup A");
        setIsCustomGroup(true);
      }
    } else {
      const configuredStages = competition.stages || [];
      if (configuredStages.length > 0) {
        const sorted = [...configuredStages].sort((a, b) => b.order_number - a.order_number);
        setPhaseLabel(sorted[0]?.name || "Babak Penyisihan");
      } else {
        setPhaseLabel("Babak Penyisihan");
      }
      setIsCustomPhase(false);
      setGroupName("");
      setIsCustomGroup(false);
    }
  }, [stageType, competition.stages, allTeams, open]);

  // Group auto-fill effect based on selected teams
  useEffect(() => {
    if (stageType === "group" || stageType === "playoff") {
      let detectedGroup = "";
      if (!is17an) {
        const t1 = allTeams.find((t) => t.id === team1Id);
        const t2 = allTeams.find((t) => t.id === team2Id);
        if (stageType === "group") {
          if (t1?.group_name) detectedGroup = t1.group_name;
          else if (t2?.group_name) detectedGroup = t2.group_name;
        } else {
          if (t1?.next_stage_type === "playoff" && t1.next_stage_label) detectedGroup = t1.next_stage_label;
          else if (t2?.next_stage_type === "playoff" && t2.next_stage_label) detectedGroup = t2.next_stage_label;
        }
      } else {
        const firstSelected = allTeams.find((t) => selectedTeamIds.includes(t.id));
        if (stageType === "group") {
          if (firstSelected?.group_name) detectedGroup = firstSelected.group_name;
        } else {
          if (firstSelected?.next_stage_type === "playoff" && firstSelected.next_stage_label) detectedGroup = firstSelected.next_stage_label;
        }
      }
      if (detectedGroup) {
        setGroupName(detectedGroup);
        setIsCustomGroup(false);
      }
    }
  }, [stageType, team1Id, team2Id, selectedTeamIds, allTeams, is17an]);

  // Auto-scheduling / Location suggestion based on stage, group, and phase
  useEffect(() => {
    if (!open) return;
    
    const matchingMatch = (competition.matches || []).find((m) => {
      const isSameStage = m.stage === (stageType === "knockout" ? "knockout" : "group");
      const isSameGroup = (stageType === "knockout") ? true : m.group_name === groupName;
      const isSamePhase = (stageType === "knockout") ? m.phase_label === phaseLabel : true;
      return isSameStage && isSameGroup && isSamePhase && m.match_datetime;
    });

    if (matchingMatch && matchingMatch.match_datetime) {
      try {
        const parsed = parseISO(matchingMatch.match_datetime);
        // Only auto-fill suggestion if the matched datetime is in the future
        if (parsed.getTime() > Date.now()) {
          const formatted = format(parsed, "yyyy-MM-dd'T'HH:mm");
          setMatchDatetime(formatted);
        }
        if (matchingMatch.location) {
          setLocation(matchingMatch.location);
        }
      } catch (e) {
        console.error("Error setting suggested datetime:", e);
      }
    }
  }, [stageType, groupName, phaseLabel, competition.matches, open]);

  const createMutation = useCreateMatch();
  const assignTeams = useAssignMatchTeams();

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const targetCount = Math.max(1, parseInt(maxParticipants, 10) || 1);

  const handleSubmit = () => {
    let finalRound = roundNumber;
    let finalMatch = matchNumber;

    if (isTeamMatchFormat) {
      if (!finalRound) finalRound = "1";
      if (!finalMatch) {
        const existingMatches = competition.matches || [];
        const nextNum = existingMatches.length > 0
          ? Math.max(...existingMatches.map(m => m.match_number || 0)) + 1
          : 1;
        finalMatch = String(nextNum);
      }
    }

    if (!finalRound || !finalMatch) {
      toast({
        variant: "destructive",
        title: "Data Tidak Lengkap",
        description: "Harap isi babak dan nomor pertandingan.",
      });
      return;
    }

    // Determine team ids based on selectionMode
    let teamIds: string[] = [];

    if (selectionMode === "manual") {
      if (is17an) {
        teamIds = selectedTeamIds;
      } else {
        if (!team1Id || team1Id === "none" || !team2Id || team2Id === "none") {
          toast({
            variant: "destructive",
            title: "Tim Belum Lengkap",
            description: "Untuk format pertandingan ini, Anda wajib memilih kedua Tim 1 dan Tim 2.",
          });
          return;
        }
        if (team1Id === team2Id) {
          toast({
            variant: "destructive",
            title: "Kesalahan Tim",
            description: "Tim 1 dan Tim 2 tidak boleh sama.",
          });
          return;
        }
        teamIds.push(team1Id);
        teamIds.push(team2Id);
      }
    } else if (selectionMode === "random") {
      if (allTeams.length < targetCount) {
        toast({
          variant: "destructive",
          title: "Peserta Kurang",
          description: `Hanya tersedia ${allTeams.length} peserta, kurang dari batas ${targetCount}.`,
        });
        return;
      }
      const shuffled = [...allTeams].sort(() => Math.random() - 0.5);
      teamIds = shuffled.slice(0, targetCount).map((t) => t.id);
    }
    // "spin" mode: create with no teams, then open spin wheel

    createMutation.mutate(
      {
        competition_id: competition.id,
        round_number: parseInt(finalRound, 10),
        match_number: parseInt(finalMatch, 10),
        team1_id: !is17an && selectionMode === "manual" && team1Id && team1Id !== "none" ? team1Id : undefined,
        team2_id: !is17an && selectionMode === "manual" && team2Id && team2Id !== "none" ? team2Id : undefined,
        team_ids:
          selectionMode === "random"
            ? teamIds
            : selectionMode === "manual" && is17an
              ? teamIds
              : undefined,
        match_datetime: matchDatetime ? new Date(matchDatetime).toISOString() : undefined,
        location: location || undefined,
        max_participants: targetCount,
        age_bracket_min:
          bracketMin.trim() === "" ? null : Number(bracketMin.replace(",", ".")),
        age_bracket_max:
          bracketMax.trim() === "" ? null : Number(bracketMax.replace(",", ".")),
        age_bracket_label: bracketLabel.trim() || null,
        stage: stageType === "knockout" ? "knockout" : "group",
        phase_label: phaseLabel.trim() || null,
        group_name: (stageType === "group" || stageType === "playoff") ? (groupName.trim() || null) : null,
      },
      {
        onSuccess: (result) => {
          if (selectionMode === "spin") {
            setSpinFor({ matchId: result.match_id, target: targetCount });
          } else {
            onOpenChange(false);
          }
        },
        onError: (error) => {
          console.error("Create failed:", error);
          toast({
            variant: "destructive",
            title: "Gagal Membuat",
            description: "Terjadi kesalahan saat membuat pertandingan.",
          });
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open && !spinFor} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {is17an ? "Buat Sesi/Lomba Baru" : "Buat Pertandingan Baru"}
            </DialogTitle>
            <DialogDescription>
              Tentukan jumlah peserta dan cara memilihnya.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(!isTeamMatchFormat || is17an) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Babak (Round)</Label>
                  <Input
                    value={roundNumber}
                    onChange={(e) => setRoundNumber(e.target.value)}
                    placeholder="Contoh: 1"
                    type="number"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor Sesi/Match</Label>
                  <Input
                    value={matchNumber}
                    onChange={(e) => setMatchNumber(e.target.value)}
                    placeholder="Contoh: 1"
                    type="number"
                    min="1"
                  />
                </div>
              </div>
            )}

            {(!isTeamMatchFormat || is17an) && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Jumlah Peserta per Match
                </Label>
                <Input
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!v || v < 1) setMaxParticipants("1");
                  }}
                  type="number"
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Batas jumlah peserta yang akan bertanding pada match ini.
                </p>
              </div>
            )}

            {/* Stage, Phase & Group Configurations */}
            <div className="space-y-4 rounded-xl border p-4 bg-muted/15 shadow-sm">
              <Label className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Swords className="w-4 h-4 text-primary" />
                Tahapan Pertandingan
              </Label>
              
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">Tahap (Stage)</Label>
                <RadioGroup
                  value={stageType}
                  onValueChange={(v) => setStageType(v as "group" | "playoff" | "knockout")}
                  className="grid grid-cols-3 gap-2"
                >
                  <Label
                    htmlFor="stage-group"
                    className={cn(
                      "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                      stageType === "group" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                    )}
                  >
                    <RadioGroupItem id="stage-group" value="group" className="sr-only" />
                    Babak Grup
                  </Label>
                  <Label
                    htmlFor="stage-playoff"
                    className={cn(
                      "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                      stageType === "playoff" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                    )}
                  >
                    <RadioGroupItem id="stage-playoff" value="playoff" className="sr-only" />
                    Playoff Grup
                  </Label>
                  <Label
                    htmlFor="stage-knockout"
                    className={cn(
                      "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                      stageType === "knockout" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                    )}
                  >
                    <RadioGroupItem id="stage-knockout" value="knockout" className="sr-only" />
                    Babak Gugur
                  </Label>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Phase label field */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Label Babak / Fase</Label>
                  {isCustomPhase ? (
                    <div className="flex gap-1.5">
                      <Input
                        value={phaseLabel}
                        onChange={(e) => setPhaseLabel(e.target.value)}
                        placeholder="Contoh: Semifinal, Final"
                        className="h-9 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCustomPhase(false)}
                        className="h-9 px-2 text-[10px] shrink-0"
                      >
                        Daftar
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={phaseLabel}
                      onValueChange={(val) => {
                        if (val === "__custom__") {
                          setIsCustomPhase(true);
                          setPhaseLabel("");
                        } else {
                          setPhaseLabel(val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Pilih Fase" />
                      </SelectTrigger>
                      <SelectContent>
                        {phaseLabelOptions.map((opt) => (
                          <SelectItem key={opt} value={opt} className="text-xs">
                            {opt}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom__" className="text-xs text-primary font-semibold">
                          + Tulis Kustom...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Group name field */}
                {(stageType === "group" || stageType === "playoff") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      {stageType === "playoff" ? "Nama Playoff Grup" : "Nama Grup"}
                    </Label>
                    {isCustomGroup ? (
                      <div className="flex gap-1.5">
                        <Input
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="Contoh: A, B, Playoff A"
                          className="h-9 text-xs flex-1"
                        />
                        {groupNameOptions.length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCustomGroup(false)}
                            className="h-9 px-2 text-[10px] shrink-0"
                          >
                            Daftar
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Select
                        value={groupName}
                        onValueChange={(val) => {
                          if (val === "__custom__") {
                            setIsCustomGroup(true);
                            setGroupName("");
                          } else {
                            setGroupName(val);
                          }
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Pilih Grup" />
                        </SelectTrigger>
                        <SelectContent>
                          {groupNameOptions.map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs">
                              {opt}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__" className="text-xs text-primary font-semibold">
                            + Tambah Baru...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cara Memilih Peserta</Label>
              <RadioGroup
                value={selectionMode}
                onValueChange={(v) => setSelectionMode(v as SelectionMode)}
                className="grid grid-cols-1 gap-2"
              >
                <Label
                  htmlFor="mode-manual"
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <RadioGroupItem id="mode-manual" value="manual" />
                  <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Pilih Manual</div>
                    <div className="text-xs text-muted-foreground">
                      Pilih peserta secara manual dari daftar.
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-random"
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <RadioGroupItem id="mode-random" value="random" />
                  <Shuffle className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Acak Otomatis</div>
                    <div className="text-xs text-muted-foreground">
                      Sistem memilih peserta secara acak sesuai batas.
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-spin"
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <RadioGroupItem id="mode-spin" value="spin" />
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Spin Wheel</div>
                    <div className="text-xs text-muted-foreground">
                      Buka roda putar untuk memilih peserta setelah membuat match.
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="mode-later"
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30"
                >
                  <RadioGroupItem id="mode-later" value="later" />
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Tentukan Nanti</div>
                    <div className="text-xs text-muted-foreground">
                      Buat match kosong. Peserta dapat ditentukan nanti.
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {selectionMode === "manual" && (
              is17an ? (
              <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Pilih Peserta ({selectedTeamIds.length}/{targetCount})
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 h-auto py-1"
                      onClick={() => {
                        if (selectedTeamIds.length === bracketedTeams.length) {
                          setSelectedTeamIds([]);
                        } else {
                          setMaxParticipants(bracketedTeams.length.toString());
                          setSelectedTeamIds(bracketedTeams.map((t) => t.id));
                        }
                      }}
                    >
                      {selectedTeamIds.length === bracketedTeams.length && bracketedTeams.length > 0
                        ? "Batal Pilih Semua"
                        : `Pilih Semua (${bracketedTeams.length})`}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Peserta yang sudah terdaftar dapat dipakai lagi di pertandingan lain
                    {matchBracket ? " — daftar disaring sesuai rentang umur match ini." : " — dikelompokkan per grup umur."}
                  </p>
                  <div className="border rounded-md p-2 space-y-3 max-h-56 overflow-y-auto bg-muted/20">
                    {teamsByAgeBracket.map(([bracketLabelText, teams]) => (
                      <div key={bracketLabelText} className="space-y-1.5">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            {bracketLabelText}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{teams.length} peserta</span>
                        </div>
                        {teams.map((team) => {
                          const checked = selectedTeamIds.includes(team.id);
                          const disabled = !checked && selectedTeamIds.length >= targetCount;
                          const members = (team as CompetitionTeamWithMembers).members || [];
                          return (
                            <div
                              key={team.id}
                              className={cn(
                                "flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer",
                                checked
                                  ? "bg-primary/10 border-primary/30"
                                  : disabled
                                  ? "opacity-50 cursor-not-allowed border-transparent"
                                  : "hover:bg-muted/50 border-transparent hover:border-border"
                              )}
                              onClick={() => !disabled && toggleTeam(team.id)}
                            >
                              <Checkbox
                                id={`team-${team.id}`}
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={() => toggleTeam(team.id)}
                                className="mt-0.5 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <Label
                                  htmlFor={`team-${team.id}`}
                                  className={cn(
                                    "text-sm font-semibold cursor-pointer flex items-center gap-1.5",
                                    checked ? "text-primary" : "",
                                    disabled ? "cursor-not-allowed" : ""
                                  )}
                                >
                                  <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                                  <span>{extractFlagAndName(team.name).name}</span>
                                  {team.age != null && (
                                    <span className="text-[10px] font-normal text-muted-foreground">
                                      ({team.age} thn)
                                    </span>
                                  )}
                                </Label>
                                {members.length > 0 && (
                                  <div className="flex flex-wrap gap-x-2 gap-y-0 mt-0.5">
                                    {members.map((m) => {
                                      const parsed = parseMemberName(m.name);
                                      const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                      return (
                                        <span key={m.id} className="text-[10px] text-muted-foreground">
                                          {name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    {bracketedTeams.length === 0 && (
                      <p className="text-xs text-muted-foreground p-4 text-center">
                        {allTeams.length === 0
                          ? "Belum ada peserta terdaftar."
                          : "Tidak ada peserta pada rentang umur match ini."}
                      </p>
                    )}
                  </div>
                </div>

              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 border border-amber-500/25 rounded-md p-2 flex items-center gap-2">
                    <Swords className="w-3.5 h-3.5 shrink-0" />
                    <span>Pertandingan format ini wajib mempertemukan <strong>2 tim berbeda</strong>.</span>
                  </div>

                  {/* Team 1 picker */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      Tim 1 <span className="text-destructive font-bold">*</span>
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/20">
                      {eligibleTeams.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2 text-center">Belum ada tim tersedia.</p>
                      )}
                      {eligibleTeams.map((team) => {
                        const met = hasMet(team.id, team2Id);
                        const isSelected = team1Id === team.id;
                        const isDisabled = team.id === team2Id || met;
                        const members = (team as CompetitionTeamWithMembers).members || [];
                        return (
                          <button
                            key={team.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setTeam1Id(isSelected ? "" : team.id)}
                            className={cn(
                              "w-full text-left rounded-lg border px-3 py-2 transition-all duration-150",
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : isDisabled
                                ? "opacity-40 cursor-not-allowed border-border bg-muted/20"
                                : "border-border bg-background hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn("text-sm font-semibold flex items-center gap-1.5", isSelected ? "text-primary" : "")}>
                                <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                                <span>{extractFlagAndName(team.name).name}</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {team.group_name && (
                                  <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                    Grup {team.group_name}
                                  </span>
                                )}
                                {met && <span className="text-[10px] text-amber-600">(sudah bertemu)</span>}
                              </div>
                            </div>
                            {members.length > 0 && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                {members.map((m) => {
                                  const parsed = parseMemberName(m.name);
                                  const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                  return (
                                    <span key={m.id} className="text-[10px] text-muted-foreground">
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team 2 picker */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      Tim 2 <span className="text-destructive font-bold">*</span>
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto border rounded-md p-2 bg-muted/20">
                      {eligibleTeams.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2 text-center">Belum ada tim tersedia.</p>
                      )}
                      {eligibleTeams.map((team) => {
                        const met = hasMet(team.id, team1Id);
                        const isSelected = team2Id === team.id;
                        const isDisabled = team.id === team1Id || met;
                        const members = (team as CompetitionTeamWithMembers).members || [];
                        return (
                          <button
                            key={team.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setTeam2Id(isSelected ? "" : team.id)}
                            className={cn(
                              "w-full text-left rounded-lg border px-3 py-2 transition-all duration-150",
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : isDisabled
                                ? "opacity-40 cursor-not-allowed border-border bg-muted/20"
                                : "border-border bg-background hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn("text-sm font-semibold flex items-center gap-1.5", isSelected ? "text-primary" : "")}>
                                <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                                <span>{extractFlagAndName(team.name).name}</span>
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {team.group_name && (
                                  <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                    Grup {team.group_name}
                                  </span>
                                )}
                                {met && <span className="text-[10px] text-amber-600">(sudah bertemu)</span>}
                              </div>
                            </div>
                            {members.length > 0 && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                {members.map((m) => {
                                  const parsed = parseMemberName(m.name);
                                  const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                                  return (
                                    <span key={m.id} className="text-[10px] text-muted-foreground">
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isLigaGrup && (stageType === "group" || stageType === "playoff") && eligibleTeams.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada tim di {stageType === "playoff" ? "Playoff Grup" : "Grup"} {groupName || "?"}. Isi Nama Grup atau assign tim ke grup ini terlebih dahulu.
                    </p>
                  )}
                </div>
              )
            )}

            {selectionMode !== "manual" && selectionMode !== "later" && (
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                Tersedia <strong>{allTeams.length}</strong> peserta terdaftar. Sistem akan{" "}
                {selectionMode === "random" ? "mengacak" : "memutar roda untuk memilih"}{" "}
                <strong>{targetCount}</strong> peserta.
              </div>
            )}




            <div className="space-y-2">
              <Label>Waktu Pertandingan</Label>
              <Input
                value={matchDatetime}
                onChange={(e) => setMatchDatetime(e.target.value)}
                type="datetime-local"
              />
            </div>

            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Lapangan A"
              />
            </div>

            {sameDayConflicts.length > 0 && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Pertandingan lain di hari yang sama</p>
                  {sameDayConflicts.map(({ teamName, match }) => (
                    <p key={`${teamName}-${match.id}`} className="text-xs">
                      • {teamName} sudah bertanding pada{" "}
                      <span className="font-semibold">
                        {match.phase_label || `Babak ${match.round_number}`}
                      </span>
                      {match.team1 && match.team2 ? (
                        <> ({match.team1.name} vs {match.team2.name})</>
                      ) : null}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {selectionMode === "spin" ? "Buat & Buka Spin Wheel" : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {spinFor && (
        <SpinWheelDialog
          open={!!spinFor}
          onOpenChange={(o) => {
            if (!o) {
              setSpinFor(null);
              onOpenChange(false);
            }
          }}
          teams={allTeams}
          targetCount={spinFor.target}
          allowTargetEdit={false}
          applying={assignTeams.isPending}
          title={`Spin Wheel — Match ${matchNumber}`}
          description="Putar untuk memilih peserta. Sistem berhenti otomatis saat batas tercapai."
          onApply={(picked) => {
            assignTeams.mutate(
              {
                match_id: spinFor.matchId,
                competition_id: competition.id,
                team_ids: picked,
                use_team_slots: !is17an && spinFor.target <= 2,
              },
              {
                onSuccess: () => {
                  setSpinFor(null);
                  onOpenChange(false);
                },
              },
            );
          }}
        />
      )}
    </>
  );
}
