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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users, Sparkles, Shuffle, MousePointerClick, Swords, Calendar } from "lucide-react";
import { useCreateMatch } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { SpinWheelDialog } from "@/components/competitions/SpinWheelDialog";
import { useAssignMatchTeams } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails, CompetitionMatchWithTeams } from "@/types/competition";

interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

type SelectionMode = "manual" | "random" | "spin";

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
  const [matchDatetime, setMatchDatetime] = useState("");
  const [location, setLocation] = useState("");
  const [maxParticipants, setMaxParticipants] = useState<string>("2");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("manual");
  const [spinFor, setSpinFor] = useState<{ matchId: string; target: number } | null>(null);
  const [bracketMin, setBracketMin] = useState("");
  const [bracketMax, setBracketMax] = useState("");
  const [bracketLabel, setBracketLabel] = useState("");

  // Simplified Match Stage/Phase States
  const [stage, setStage] = useState<string>("knockout");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [groupName, setGroupName] = useState("");

  const is17an = competition.format === "17an";
  const isTeamMatchFormat = competition.match_type && competition.match_type !== "1v1";
  const allTeams = competition.teams || [];
  const isLigaGrup = competition.format === "liga_grup";

  // Teams eligible for selection (in liga_grup group stage, restrict to selected group)
  const eligibleTeams =
    isLigaGrup && stage === "group" && groupName
      ? allTeams.filter((t) => t.group_name === groupName)
      : allTeams;

  // Pre-compute pairs that already met in group stage of the same group
  const metPairs = new Set<string>();
  if (isLigaGrup && stage === "group") {
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
  const selectedDateStr = matchDatetime ? format(parseISO(matchDatetime), "yyyy-MM-dd") : null;

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

  useEffect(() => {
    if (open) {
      setMaxParticipants(is17an ? "3" : "2");
      setSelectionMode("manual");
      
      const isGroupStageDefault = competition.format === "liga_grup";
      setStage(isGroupStageDefault ? "group" : "knockout");
      setPhaseLabel(isGroupStageDefault ? "Group Stage" : "Babak Penyisihan");
      setGroupName(isGroupStageDefault ? "A" : "");

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
        if (!location) setLocation(competition.events.location || "");
        if (!matchDatetime) {
          const eventDate = competition.events.event_date;
          const eventTime = competition.events.event_time;
          if (eventDate) {
            const datePart = eventDate;
            const timePart = eventTime || "08:00";
            setMatchDatetime(`${datePart}T${timePart}`);
          }
        }
      }
    } else {
      setRoundNumber("1");
      setMatchNumber("1");
      setTeam1Id("");
      setTeam2Id("");
      setSelectedTeamIds([]);
      setMatchDatetime("");
      setLocation("");
      setMaxParticipants("2");
      setSelectionMode("manual");
      setSpinFor(null);
      setBracketMin("");
      setBracketMax("");
      setBracketLabel("");
      setStage("knockout");
      setPhaseLabel("");
      setGroupName("");
    }
  }, [open, competition.events, competition.format, competition.match_type, is17an, isTeamMatchFormat]);

  // Group auto-fill effect based on selected teams
  useEffect(() => {
    if (stage === "group") {
      let detectedGroup = "";
      if (!is17an) {
        const t1 = allTeams.find((t) => t.id === team1Id);
        const t2 = allTeams.find((t) => t.id === team2Id);
        if (t1?.group_name) {
          detectedGroup = t1.group_name;
        } else if (t2?.group_name) {
          detectedGroup = t2.group_name;
        }
      } else {
        const firstSelected = allTeams.find((t) => selectedTeamIds.includes(t.id));
        if (firstSelected?.group_name) {
          detectedGroup = firstSelected.group_name;
        }
      }
      if (detectedGroup) {
        setGroupName(detectedGroup);
      }
    }
  }, [stage, team1Id, team2Id, selectedTeamIds, allTeams, is17an]);

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
        stage: stage || null,
        phase_label: phaseLabel.trim() || null,
        group_name: stage === "group" ? (groupName.trim() || null) : null,
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

            {!isTeamMatchFormat && (
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
              </RadioGroup>
            </div>

            {selectionMode === "manual" && (
              is17an ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pilih Peserta ({selectedTeamIds.length}/{targetCount})
                  </Label>
                  <div className="border rounded-md p-2 space-y-2 max-h-48 overflow-y-auto bg-muted/20">
                    {allTeams.map((team) => {
                      const checked = selectedTeamIds.includes(team.id);
                      const disabled = !checked && selectedTeamIds.length >= targetCount;
                      return (
                        <div key={team.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded transition-colors">
                          <Checkbox
                            id={`team-${team.id}`}
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => toggleTeam(team.id)}
                          />
                          <Label
                            htmlFor={`team-${team.id}`}
                            className={`flex-1 cursor-pointer text-sm font-normal ${disabled ? "opacity-50" : ""}`}
                          >
                            {team.name}
                          </Label>
                        </div>
                      );
                    })}
                    {allTeams.length === 0 && (
                      <p className="text-xs text-muted-foreground p-4 text-center">
                        Belum ada peserta terdaftar.
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Tim 1 <span className="text-destructive font-bold">*</span>
                      </Label>
                      <Select value={team1Id} onValueChange={setTeam1Id}>
                        <SelectTrigger className={!team1Id || team1Id === "none" ? "border-amber-500/50" : ""}>
                          <SelectValue placeholder="Pilih Tim 1" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Pilih Tim 1</SelectItem>
                          {eligibleTeams.map((team) => {
                            const met = hasMet(team.id, team2Id);
                            return (
                              <SelectItem
                                key={team.id}
                                value={team.id}
                                disabled={team.id === team2Id || met}
                              >
                                {team.name}
                                {met ? " (sudah bertemu)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Tim 2 <span className="text-destructive font-bold">*</span>
                      </Label>
                      <Select value={team2Id} onValueChange={setTeam2Id}>
                        <SelectTrigger className={!team2Id || team2Id === "none" ? "border-amber-500/50" : ""}>
                          <SelectValue placeholder="Pilih Tim 2" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Pilih Tim 2</SelectItem>
                          {eligibleTeams.map((team) => {
                            const met = hasMet(team.id, team1Id);
                            return (
                              <SelectItem
                                key={team.id}
                                value={team.id}
                                disabled={team.id === team1Id || met}
                              >
                                {team.name}
                                {met ? " (sudah bertemu)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {isLigaGrup && stage === "group" && eligibleTeams.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada tim di Grup {groupName || "?"}. Isi Nama Grup atau assign tim ke grup ini terlebih dahulu.
                    </p>
                  )}
                </div>
              )
            )}

            {selectionMode !== "manual" && (
              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                Tersedia <strong>{allTeams.length}</strong> peserta terdaftar. Sistem akan{" "}
                {selectionMode === "random" ? "mengacak" : "memutar roda untuk memilih"}{" "}
                <strong>{targetCount}</strong> peserta.
              </div>
            )}

            {/* Stage, Phase & Group Configurations */}
            <div className="space-y-3 rounded-md border p-3 bg-muted/10">
              <Label className="text-sm font-semibold">Tahapan Pertandingan</Label>
              
              <div className="space-y-2">
                <Label>Tahap (Stage)</Label>
                <RadioGroup
                  value={stage}
                  onValueChange={(v) => {
                    setStage(v);
                    if (v === "group") {
                      setPhaseLabel("Group Stage");
                    } else if (phaseLabel === "Group Stage") {
                      setPhaseLabel("Babak Penyisihan");
                    }
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="stage-group" value="group" />
                    <Label htmlFor="stage-group" className="font-normal cursor-pointer">
                      Babak Grup
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="stage-knockout" value="knockout" />
                    <Label htmlFor="stage-knockout" className="font-normal cursor-pointer">
                      Babak Gugur (Knockout)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Label Babak / Fase</Label>
                  <Input
                    value={phaseLabel}
                    onChange={(e) => setPhaseLabel(e.target.value)}
                    placeholder="Contoh: Semifinal, Final, Group Stage"
                  />
                </div>
                {stage === "group" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Nama Grup</Label>
                    <Input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Contoh: A, B, C"
                    />
                  </div>
                )}
              </div>
            </div>


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
