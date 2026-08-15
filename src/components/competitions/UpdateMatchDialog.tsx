import { useState, useEffect, useMemo } from "react";
import { parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Trophy, Medal, Plus, X, Swords, Users, Trash2 } from "lucide-react";

import { useUpdateMatch } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails, MatchStatus, CompetitionTeamWithMembers } from "@/types/competition";
import { MATCH_STATUS_LABELS } from "@/types/competition";
import { extractFlagAndName } from "@/lib/countries";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { parseMemberName, capitalizeName, cn } from "@/lib/utils";
interface UpdateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: CompetitionMatchWithTeams | null;
  competition: EventCompetitionWithDetails;
}

export function UpdateMatchDialog({
  open,
  onOpenChange,
  match,
  competition,
}: UpdateMatchDialogProps) {
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [participantScores, setParticipantScores] = useState<Record<string, string>>({});
  const [participantWinners, setParticipantWinners] = useState<Record<string, boolean>>({});
  const [participantRanks, setParticipantRanks] = useState<Record<string, number | null>>({});
  const [participantTeams, setParticipantTeams] = useState<Record<string, string>>({});
  const [winnerRank1, setWinnerRank1] = useState<number | null>(null);
  const [winnerRank2, setWinnerRank2] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string>("");
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [location, setLocation] = useState("Lapangan Badminton PKT");
  const [notes, setNotes] = useState("");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [matchDatetime, setMatchDatetime] = useState("");
  const [isPoint, setIsPoint] = useState(true);
  const [isFinal, setIsFinal] = useState(false);
  const [sets, setSets] = useState<{ team1_score: number | ""; team2_score: number | "" }[]>([]);
  const [localParticipants, setLocalParticipants] = useState<{ id: string; isNew?: boolean }[]>([]);
  const [deletedParticipantIds, setDeletedParticipantIds] = useState<string[]>([]);

  // Additional editable fields
  const [roundNumber, setRoundNumber] = useState("1");
  const [matchNumber, setMatchNumber] = useState("1");
  const [stageType, setStageType] = useState<"group" | "playoff" | "knockout">("knockout");
  const [groupName, setGroupName] = useState("");
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");
  const [isCustomPhase, setIsCustomPhase] = useState(false);
  const [isCustomGroup, setIsCustomGroup] = useState(false);

  const is17an = competition.format === "17an";
  const isTeamMatchFormat = competition.match_type && competition.match_type !== "1v1";
  const allTeams = competition.teams || [];

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

  const filteredTeams = useMemo(() => {
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
    }
    
    return allTeams;
  }, [stageType, groupName, phaseLabel, allTeams]);

  const getConflictWarning = (teamId: string, roleName: string) => {
    if (!teamId || teamId === "none" || !matchDatetime) return null;
    const targetDateString = matchDatetime.split("T")[0];
    if (!targetDateString) return null;

    const conflictingMatch = competition.matches?.find((m) => {
      if (m.id === match?.id) return false;
      if (!m.match_datetime) return false;
      const matchDateString = m.match_datetime.split("T")[0];
      return matchDateString === targetDateString && (m.team1_id === teamId || m.team2_id === teamId);
    });

    if (conflictingMatch) {
      const otherTeamId = conflictingMatch.team1_id === teamId ? conflictingMatch.team2_id : conflictingMatch.team1_id;
      const otherTeamName = allTeams.find((t) => t.id === otherTeamId)?.name || "TBD";
      const matchTime = conflictingMatch.match_datetime
        ? new Date(conflictingMatch.match_datetime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "";
      return `${roleName} sudah memiliki jadwal tanding pada tanggal ini (${matchTime} vs ${otherTeamName}).`;
    }
    return null;
  };

  const team1Warning = getConflictWarning(team1Id, "Tim 1");
  const team2Warning = getConflictWarning(team2Id, "Tim 2");


  const { toast } = useToast();
  const updateMutation = useUpdateMatch();

  useEffect(() => {
    if (match) {
      setScore1(match.score1 || "");
      setScore2(match.score2 || "");
      setWinnerId(match.winner_id || "");
      setStatus(match.status);
      setLocation(match.location || "Lapangan Badminton PKT");
      setNotes(match.notes || "");
      setPhaseLabel(match.phase_label || "");
      setIsPoint(match.is_point !== false);
      setIsFinal(match.is_final || false);
      setRoundNumber(String(match.round_number || 1));
      setMatchNumber(String(match.match_number || 1));
      
      const isPlayoffGroup = match.stage === "group" && allTeams.some(
        (t) => t.next_stage_type === "playoff" && t.next_stage_label === match.group_name
      );
      setStageType(match.stage === "knockout" ? "knockout" : (isPlayoffGroup ? "playoff" : "group"));
      
      setGroupName(match.group_name || "");
      setTeam1Id(match.team1_id || "");
      setTeam2Id(match.team2_id || "");

      // Determine custom selections
      const hasPhaseInOptions = phaseLabelOptions.includes(match.phase_label || "");
      setIsCustomPhase(match.phase_label ? !hasPhaseInOptions : false);

      const hasGroupInOptions = groupNameOptions.includes(match.group_name || "");
      setIsCustomGroup(match.group_name ? !hasGroupInOptions : false);

      if (Array.isArray(match.sets_data) && match.sets_data.length > 0) {
        setSets(match.sets_data.map((s) => ({ team1_score: s.team1_score ?? 0, team2_score: s.team2_score ?? 0 })));
      } else {
        const defaultSets = Math.max(2, competition.sets_per_match ?? 2);
        setSets(Array.from({ length: defaultSets }, () => ({ team1_score: "" as const, team2_score: "" as const })));
      }

      
      // Handle simple winner ranks for 1v1
      if (match.participants && match.participants.length >= 2) {
        const p1 = match.participants.find(p => p.team_id === match.team1_id);
        const p2 = match.participants.find(p => p.team_id === match.team2_id);
        setWinnerRank1(p1?.winner_rank || null);
        setWinnerRank2(p2?.winner_rank || null);
      }
      
      // Handle participants
      if (match.participants) {
        setLocalParticipants(match.participants.map(p => ({ id: p.id })));
        setDeletedParticipantIds([]);
        const scores: Record<string, string> = {};
        const winners: Record<string, boolean> = {};
        const ranks: Record<string, number | null> = {};
        const teams: Record<string, string> = {};
        match.participants.forEach(p => {
          scores[p.id] = p.score || "";
          winners[p.id] = p.is_winner || false;
          ranks[p.id] = p.winner_rank || null;
          teams[p.id] = p.team_id || "none";
        });
        setParticipantScores(scores);
        setParticipantWinners(winners);
        setParticipantRanks(ranks);
        setParticipantTeams(teams);
      }

      if (match.match_datetime) {
        // Format for datetime-local input (YYYY-MM-DDThh:mm) using parseISO for consistency
        const date = parseISO(match.match_datetime);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        setMatchDatetime(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } else {
        setMatchDatetime("");
      }
    }
  }, [match, competition.sets_per_match]);

  // Derive sets-won and effective score/winner from the sets editor
  const validSets = sets.filter(
    (s) => s.team1_score !== "" && s.team2_score !== "" && !(Number(s.team1_score) === 0 && Number(s.team2_score) === 0)
  );
  const setsWon1 = validSets.filter((s) => Number(s.team1_score) > Number(s.team2_score)).length;
  const setsWon2 = validSets.filter((s) => Number(s.team2_score) > Number(s.team1_score)).length;
  const useSets = validSets.length > 0 && !!match?.team1_id && !!match?.team2_id;
  const effectiveScore1 = useSets ? String(setsWon1) : score1;
  const effectiveScore2 = useSets ? String(setsWon2) : score2;
  const effectiveWinnerId = useSets
    ? setsWon1 > setsWon2
      ? match?.team1_id || ""
      : setsWon2 > setsWon1
      ? match?.team2_id || ""
      : ""
    : winnerId;

  const handleSubmit = () => {
    if (!match) return;

    if (!is17an) {
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
    }

    const teamIds = [team1Id, team2Id].filter(id => id && id !== "none");

    const participantsData = (!is17an)
      ? teamIds.map((tId) => {
          const isTeam1 = tId === team1Id;
          const scoreVal = isTeam1 ? effectiveScore1 : effectiveScore2;
          const isWinner = isTeam1
            ? (effectiveWinnerId === team1Id || winnerRank1 === 1)
            : (effectiveWinnerId === team2Id || winnerRank2 === 1);
          const rankVal = isTeam1 ? winnerRank1 : winnerRank2;
          
          const existing = match.participants?.find(p => p.team_id === tId);
          return {
            id: existing?.id,
            team_id: tId,
            score: scoreVal || null,
            is_winner: isWinner,
            winner_rank: rankVal,
          };
        })
      : (localParticipants && localParticipants.length > 0)
        ? localParticipants.map(p => {
            const teamIdVal = participantTeams[p.id];
            const finalTeamId = teamIdVal === "none" ? null : (teamIdVal || null);
            return {
              id: p.isNew ? undefined : p.id,
              team_id: finalTeamId,
              score: participantScores[p.id] || null,
              is_winner: participantWinners[p.id] || (participantRanks[p.id] === 1),
              winner_rank: participantRanks[p.id] || null,
            };
          })
        : undefined;

    updateMutation.mutate(
      {
        id: match.id,
        competition_id: competition.id,
        score1: effectiveScore1 || null,
        score2: effectiveScore2 || null,
        winner_id: effectiveWinnerId || null,
        status,
        location: location || null,
        notes: notes || null,
        phase_label: phaseLabel || null,
        match_datetime: matchDatetime ? new Date(matchDatetime).toISOString() : null,
        is_point: isPoint,
        is_final: isFinal,
        sets_data: useSets ? validSets.map((s) => ({ team1_score: Number(s.team1_score), team2_score: Number(s.team2_score) })) : null,
        participant_scores: participantsData,
        stage: stageType === "knockout" ? "knockout" : "group",
        group_name: (stageType === "group" || stageType === "playoff") ? (groupName.trim() || null) : null,
        round_number: parseInt(roundNumber, 10) || 1,
        match_number: parseInt(matchNumber, 10) || 1,
        team1_id: !is17an ? team1Id : null,
        team2_id: !is17an ? team2Id : null,
        team_ids: teamIds.length > 0 ? teamIds : undefined,
        deleted_participant_ids: is17an && deletedParticipantIds.length > 0 ? deletedParticipantIds : undefined,
      },

      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (error) => {
          console.error("Update failed:", error);
          toast({
            variant: "destructive",
            title: "Gagal Memperbarui",
            description: "Terjadi kesalahan saat memperbarui pertandingan.",
          });
        },
      }
    );
  };

  if (!match) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Pertandingan</DialogTitle>
          <DialogDescription>
            {match.participants && match.participants.length > 0 
              ? match.participants.map(p => p.team?.name || "TBD").join(" vs ")
              : `${match.team1?.name || "TBD"} vs ${match.team2?.name || "TBD"}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
          {/* Round & Match Numbers */}
          {!isTeamMatchFormat && (
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

          {/* Stage & Group Configuration */}
          <div className="space-y-4 rounded-xl border p-4 bg-muted/15 shadow-sm">
            <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <Swords className="w-4 h-4 text-primary" />
              Tahapan Pertandingan
            </Label>
            
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Tahap (Stage)</Label>
              <RadioGroup
                value={stageType}
                onValueChange={(v) => {
                  const newStageType = v as "group" | "playoff" | "knockout";
                  setStageType(newStageType);
                  if (newStageType === "group") {
                    setPhaseLabel("Group Stage");
                    setIsCustomPhase(false);
                  } else if (newStageType === "playoff") {
                    setPhaseLabel("Playoff");
                    setIsCustomPhase(false);
                  } else {
                    setPhaseLabel("Babak Penyisihan");
                    setIsCustomPhase(false);
                  }
                }}
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="edit-stage-group"
                  className={cn(
                    "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                    stageType === "group" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                  )}
                >
                  <RadioGroupItem id="edit-stage-group" value="group" className="sr-only" />
                  Babak Grup
                </Label>
                <Label
                  htmlFor="edit-stage-playoff"
                  className={cn(
                    "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                    stageType === "playoff" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                  )}
                >
                  <RadioGroupItem id="edit-stage-playoff" value="playoff" className="sr-only" />
                  Playoff Grup
                </Label>
                <Label
                  htmlFor="edit-stage-knockout"
                  className={cn(
                    "flex items-center justify-center rounded-lg border p-2 cursor-pointer transition-all hover:bg-muted/50 text-xs font-medium text-center",
                    stageType === "knockout" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border bg-background"
                  )}
                >
                  <RadioGroupItem id="edit-stage-knockout" value="knockout" className="sr-only" />
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

          {/* Team Selection */}
          {!is17an && (
            <div className="space-y-3">
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 border border-amber-500/25 rounded-md p-2 flex items-center gap-2">
                <Swords className="w-3.5 h-3.5 shrink-0" />
                <span>Pertandingan format ini wajib mempertemukan <strong>2 tim berbeda</strong>.</span>
              </div>

              {/* Tim 1 Card Picker */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Tim 1 <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/20">
                  {filteredTeams.map((team) => {
                    const isSelected = team1Id === team.id;
                    const isDisabled = team.id === team2Id;
                    const members = (team as CompetitionTeamWithMembers).members || [];
                    return (
                      <button
                        key={team.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setTeam1Id(isSelected ? "" : team.id)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2 transition-all duration-150",
                          isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : isDisabled ? "opacity-40 cursor-not-allowed border-border bg-muted/20"
                            : "border-border bg-background hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-sm font-semibold flex items-center gap-1.5", isSelected ? "text-primary" : "")}>
                            <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                            <span>{extractFlagAndName(team.name).name}</span>
                          </span>
                          {team.group_name && (
                            <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Grup {team.group_name}</span>
                          )}
                        </div>
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                            {members.map(m => {
                              const parsed = parseMemberName(m.name);
                              return <span key={m.id} className="text-[10px] text-muted-foreground">{capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain")}</span>;
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {team1Warning && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight font-medium">⚠️ {team1Warning}</p>
                )}
              </div>

              {/* Tim 2 Card Picker */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Tim 2 <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto border rounded-md p-2 bg-muted/20">
                  {filteredTeams.map((team) => {
                    const isSelected = team2Id === team.id;
                    const isDisabled = team.id === team1Id;
                    const members = (team as CompetitionTeamWithMembers).members || [];
                    return (
                      <button
                        key={team.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setTeam2Id(isSelected ? "" : team.id)}
                        className={cn(
                          "w-full text-left rounded-lg border px-3 py-2 transition-all duration-150",
                          isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : isDisabled ? "opacity-40 cursor-not-allowed border-border bg-muted/20"
                            : "border-border bg-background hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-sm font-semibold flex items-center gap-1.5", isSelected ? "text-primary" : "")}>
                            <TeamFlag team={team} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                            <span>{extractFlagAndName(team.name).name}</span>
                          </span>
                          {team.group_name && (
                            <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Grup {team.group_name}</span>
                          )}
                        </div>
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                            {members.map(m => {
                              const parsed = parseMemberName(m.name);
                              return <span key={m.id} className="text-[10px] text-muted-foreground">{capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain")}</span>;
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {team2Warning && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight font-medium">⚠️ {team2Warning}</p>
                )}
              </div>
            </div>
          )}


          <div className="space-y-2">
            <Label htmlFor="match-datetime">Waktu Pertandingan</Label>
            <Input
              id="match-datetime"
              type="datetime-local"
              value={matchDatetime}
              onChange={(e) => setMatchDatetime(e.target.value)}
            />
          </div>

          {/* Per-Set Scores (Badminton-style best of N) */}
          {match.team1_id && match.team2_id && (
            <div className="space-y-2 rounded-lg border p-3 bg-primary/5 border-primary/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold uppercase tracking-wider text-primary">Skor Per Set</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setSets((prev) => [...prev, { team1_score: "", team2_score: "" }])}
                  >
                    <Plus className="w-3 h-3" /> Tambah Set
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="text-center">{match.team1?.name || "Tim 1"}</div>
                <div />
                <div className="text-center">{match.team2?.name || "Tim 2"}</div>
                <div />
              </div>
              {sets.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={s.team1_score}
                    onChange={(e) =>
                      setSets((prev) => prev.map((x, ix) => (ix === i ? { ...x, team1_score: e.target.value === "" ? "" : Number(e.target.value) } : x)))
                    }
                    className="text-center font-mono"
                    placeholder="0"
                  />
                  <span className="text-xs text-muted-foreground font-bold">Set {i + 1}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={s.team2_score}
                    onChange={(e) =>
                      setSets((prev) => prev.map((x, ix) => (ix === i ? { ...x, team2_score: e.target.value === "" ? "" : Number(e.target.value) } : x)))
                    }
                    className="text-center font-mono"
                    placeholder="0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setSets((prev) => prev.filter((_, ix) => ix !== i))}
                    disabled={sets.length <= 1}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              {useSets && (
                <div className="flex items-center center pt-2 border-t border-dashed text-xs">

                  <span className="font-mono font-bold">
                    {setsWon1}
                  </span>
                  -
                  <span className="font-mono font-bold">
                    {setsWon2}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-tight">
                Contoh: Set 1 (21-19), Set 2 (14-21), Set 3 (21-17). Pemenang match ditentukan otomatis dari set terbanyak.
              </p>
            </div>
          )}



          {/* Participants Scores (17an) */}
          {is17an && (
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Skor Peserta</Label>
              <div className="grid gap-3">
                {localParticipants.map((p, index) => {
                  const currentTeamId = participantTeams[p.id] || "none";
                  return (
                    <div key={p.id} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Slot Peserta {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-destructive hover:text-destructive/80"
                          onClick={() => {
                            if (!p.isNew) {
                              setDeletedParticipantIds(prev => [...prev, p.id]);
                            }
                            setLocalParticipants(prev => prev.filter(x => x.id !== p.id));
                          }}
                        >
                          <X className="w-3 h-3 mr-1" /> Hapus
                        </Button>
                      </div>
                      
                      {/* Team card picker for this participant slot */}
                      <div className="space-y-1">
                        <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto border rounded-md p-1.5 bg-background">
                          {/* TBD option */}
                          <button
                            type="button"
                            onClick={() => setParticipantTeams(prev => ({ ...prev, [p.id]: "none" }))}
                            className={cn(
                              "w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition-all",
                              currentTeamId === "none"
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-transparent hover:border-border hover:bg-muted/40"
                            )}
                          >
                            Pilih Peserta (TBD)
                          </button>
                          {allTeams.map((t) => {
                            const isAlreadySelected = Object.entries(participantTeams).some(
                              ([pId, tId]) => pId !== p.id && tId === t.id
                            );
                            const isSelected = currentTeamId === t.id;
                            const members = (t as CompetitionTeamWithMembers).members || [];
                            return (
                              <button
                                key={t.id}
                                type="button"
                                disabled={isAlreadySelected}
                                onClick={() => setParticipantTeams(prev => ({ ...prev, [p.id]: t.id }))}
                                className={cn(
                                  "w-full text-left rounded-md border px-2.5 py-1.5 transition-all",
                                  isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                    : isAlreadySelected ? "opacity-40 cursor-not-allowed border-transparent"
                                    : "border-transparent hover:border-border hover:bg-muted/40 cursor-pointer"
                                )}
                              >
                                <span className={cn("text-sm font-semibold flex items-center gap-1.5", isSelected ? "text-primary" : "")}>
                                  <TeamFlag team={t} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                                  <span>{extractFlagAndName(t.name).name}</span>
                                </span>
                                {members.length > 0 && (
                                  <div className="flex flex-wrap gap-x-2 mt-0.5">
                                    {members.map(m => {
                                      const parsed = parseMemberName(m.name);
                                      return <span key={m.id} className="text-[10px] text-muted-foreground">{capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain")}</span>;
                                    })}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Input
                            value={participantScores[p.id] || ""}
                            onChange={(e) => setParticipantScores(prev => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Skor"
                            type="number"
                            className="text-right font-mono"
                          />
                        </div>
                        <Button
                          variant={participantWinners[p.id] ? "default" : "outline"}
                          size="sm"
                          className={`h-9 px-3 gap-1.5 transition-all ${participantWinners[p.id] ? 'bg-primary' : ''}`}
                          onClick={() => setParticipantWinners(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                        >
                          <Trophy className={`w-3.5 h-3.5 ${participantWinners[p.id] ? 'fill-current' : ''}`} />
                          {participantWinners[p.id] ? "Lolos" : "Pilih"}
                        </Button>
                      </div>

                      {isFinal && (
                        <div className="flex gap-2 pt-2 border-t border-dashed">
                          {[1, 2, 3].map((r) => (
                            <Button
                              key={r}
                              variant={participantRanks[p.id] === r ? "default" : "outline"}
                              size="sm"
                              className={cn(
                                "h-8 flex-1 gap-1 text-[10px] uppercase font-bold tracking-tighter transition-all",
                                participantRanks[p.id] === r && r === 1 ? "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500" : "",
                                participantRanks[p.id] === r && r === 2 ? "bg-slate-400 hover:bg-slate-500 text-white border-slate-400" : "",
                                participantRanks[p.id] === r && r === 3 ? "bg-amber-700 hover:bg-amber-800 text-white border-amber-700" : ""
                              )}
                              style={participantRanks[p.id] === r ? { backgroundColor: r === 1 ? '#eab308' : r === 2 ? '#94a3b8' : '#b45309', color: 'white', borderColor: 'transparent' } : {}}
                              onClick={() => setParticipantRanks(prev => ({ ...prev, [p.id]: prev[p.id] === r ? null : r }))}
                            >
                              <Medal className="w-3 h-3" />
                              Juara {r}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed flex-1"
                  onClick={() => setLocalParticipants(prev => [...prev, { id: `temp-${Date.now()}`, isNew: true }])}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Slot
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed flex-1"
                  onClick={() => {
                    const existingTeamIds = Object.values(participantTeams);
                    const unassignedTeams = allTeams.filter(t => !existingTeamIds.includes(t.id));
                    
                    const newParticipants = unassignedTeams.map((t, index) => ({
                      id: `temp-${Date.now()}-${index}`,
                      isNew: true
                    }));
                    
                    const newParticipantTeams = { ...participantTeams };
                    newParticipants.forEach((p, index) => {
                      newParticipantTeams[p.id] = unassignedTeams[index].id;
                    });
                    
                    setLocalParticipants(prev => [...prev, ...newParticipants]);
                    setParticipantTeams(newParticipantTeams);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Semua Peserta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-dashed w-9 h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
                  title="Hapus Semua Peserta"
                  onClick={() => {
                    const deletedIds = localParticipants.filter(p => !p.isNew).map(p => p.id);
                    setDeletedParticipantIds(prev => [...prev, ...deletedIds]);
                    setLocalParticipants([]);
                    setParticipantTeams({});
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Two-team score and ranking editor (for non-17an match formats) */}
          {!is17an && (
            <div className="space-y-4">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Skor & Hasil Akhir</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <TeamFlag team={allTeams.find((t) => t.id === team1Id)} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                    <span>{extractFlagAndName(allTeams.find((t) => t.id === team1Id)?.name || "Tim 1").name}</span>
                  </Label>
                  <Input
                    value={score1}
                    onChange={(e) => setScore1(e.target.value)}
                    placeholder="Skor"
                    type="number"
                  />
                  {isFinal && (
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3].map((r) => (
                        <Button
                          key={r}
                          variant={winnerRank1 === r ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 flex-1 gap-1 text-[9px] uppercase font-bold tracking-tighter transition-all",
                            winnerRank1 === r ? "border-transparent" : ""
                          )}
                          style={winnerRank1 === r ? { backgroundColor: r === 1 ? '#eab308' : r === 2 ? '#94a3b8' : '#b45309', color: 'white', borderColor: 'transparent' } : {}}
                          onClick={() => {
                            setWinnerRank1(winnerRank1 === r ? null : r);
                            if (r === 1 && winnerRank1 !== r) setWinnerId(team1Id);
                          }}
                        >
                          Juara {r}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <TeamFlag team={allTeams.find((t) => t.id === team2Id)} className="w-4 h-3 object-cover rounded shadow-sm shrink-0 border border-border/20" />
                    <span>{extractFlagAndName(allTeams.find((t) => t.id === team2Id)?.name || "Tim 2").name}</span>
                  </Label>
                  <Input
                    value={score2}
                    onChange={(e) => setScore2(e.target.value)}
                    placeholder="Skor"
                    type="number"
                  />
                  {isFinal && (
                    <div className="flex gap-1 pt-1">
                      {[1, 2, 3].map((r) => (
                        <Button
                          key={r}
                          variant={winnerRank2 === r ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-7 flex-1 gap-1 text-[9px] uppercase font-bold tracking-tighter transition-all",
                            winnerRank2 === r ? "border-transparent" : ""
                          )}
                          style={winnerRank2 === r ? { backgroundColor: r === 1 ? '#eab308' : r === 2 ? '#94a3b8' : '#b45309', color: 'white', borderColor: 'transparent' } : {}}
                          onClick={() => {
                            setWinnerRank2(winnerRank2 === r ? null : r);
                            if (r === 1 && winnerRank2 !== r) setWinnerId(team2Id);
                          }}
                        >
                          Juara {r}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Winner (Direct Selection fallback for team match formats) */}
          {!is17an && (
            <div className="space-y-2">
              <Label>Pemenang Utama</Label>
              <Select value={winnerId || "none"} onValueChange={(v) => setWinnerId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pemenang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {team1Id && team1Id !== "none" && (
                    <SelectItem value={team1Id}>
                      {allTeams.find(t => t.id === team1Id)?.name || "Tim 1"}
                    </SelectItem>
                  )}
                  {team2Id && team2Id !== "none" && (
                    <SelectItem value={team2Id}>
                      {allTeams.find(t => t.id === team2Id)?.name || "Tim 2"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Point & Final Toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5 border-primary/20">
              <div className="space-y-0.5">
                <Label className="text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Berikan Poin
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Aktifkan poin peringkat.
                </p>
              </div>
              <Switch
                checked={isPoint}
                onCheckedChange={setIsPoint}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5 border-primary/20">
              <div className="space-y-0.5">
                <Label className="text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Babak Final
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Aktifkan menu juara.
                </p>
              </div>
              <Switch
                checked={isFinal}
                onCheckedChange={setIsFinal}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="status-completed" className="text-base">
                Pertandingan Selesai
              </Label>
              <Switch
                id="status-completed"
                checked={status === "completed"}
                onCheckedChange={(checked) => {
                  setStatus(checked ? "completed" : "scheduled");
                }}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Status Detail</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MatchStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Lokasi</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lokasi pertandingan"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan pertandingan"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
