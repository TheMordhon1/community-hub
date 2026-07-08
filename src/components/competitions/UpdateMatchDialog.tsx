import { useState, useEffect } from "react";
import { parseISO } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Trophy, Medal, Plus, X, Swords } from "lucide-react";

import { useUpdateMatch } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import type { CompetitionMatchWithTeams, EventCompetitionWithDetails, MatchStatus } from "@/types/competition";
import { MATCH_STATUS_LABELS } from "@/types/competition";

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
  const [winnerRank1, setWinnerRank1] = useState<number | null>(null);
  const [winnerRank2, setWinnerRank2] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<string>("");
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [phaseLabel, setPhaseLabel] = useState("");
  const [matchDatetime, setMatchDatetime] = useState("");
  const [isPoint, setIsPoint] = useState(true);
  const [isFinal, setIsFinal] = useState(false);
  const [sets, setSets] = useState<{ team1_score: number | ""; team2_score: number | "" }[]>([]);

  // Additional editable fields
  const [roundNumber, setRoundNumber] = useState("1");
  const [matchNumber, setMatchNumber] = useState("1");
  const [stage, setStage] = useState<string>("knockout");
  const [groupName, setGroupName] = useState("");
  const [team1Id, setTeam1Id] = useState("");
  const [team2Id, setTeam2Id] = useState("");

  const is17an = competition.format === "17an";
  const isTeamMatchFormat = competition.match_type && competition.match_type !== "1v1";
  const allTeams = competition.teams || [];

  const filteredTeams = allTeams.filter((team) => {
    if (stage === "group" && groupName.trim()) {
      return team.group_name?.toUpperCase() === groupName.trim().toUpperCase();
    }
    return true;
  });

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
      setLocation(match.location || "");
      setNotes(match.notes || "");
      setPhaseLabel(match.phase_label || "");
      setIsPoint(match.is_point !== false);
      setIsFinal(match.is_final || false);
      setRoundNumber(String(match.round_number || 1));
      setMatchNumber(String(match.match_number || 1));
      setStage(match.stage || "knockout");
      setGroupName(match.group_name || "");
      setTeam1Id(match.team1_id || "");
      setTeam2Id(match.team2_id || "");

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
        const scores: Record<string, string> = {};
        const winners: Record<string, boolean> = {};
        const ranks: Record<string, number | null> = {};
        match.participants.forEach(p => {
          scores[p.id] = p.score || "";
          winners[p.id] = p.is_winner || false;
          ranks[p.id] = p.winner_rank || null;
        });
        setParticipantScores(scores);
        setParticipantWinners(winners);
        setParticipantRanks(ranks);
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
      : (match.participants && match.participants.length > 0)
        ? match.participants.map(p => ({
            id: p.id,
            team_id: p.team_id,
            score: participantScores[p.id] || null,
            is_winner: participantWinners[p.id] || (participantRanks[p.id] === 1),
            winner_rank: participantRanks[p.id] || null,
          }))
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
        stage: stage || null,
        group_name: stage === "group" ? (groupName.trim() || null) : null,
        round_number: parseInt(roundNumber, 10) || 1,
        match_number: parseInt(matchNumber, 10) || 1,
        team1_id: !is17an ? team1Id : null,
        team2_id: !is17an ? team2Id : null,
        team_ids: teamIds.length > 0 ? teamIds : undefined,
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

          {/* Team Selection */}
          {!is17an && (
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
                      {filteredTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id} disabled={team.id === team2Id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {team1Warning && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight font-medium">
                      ⚠️ {team1Warning}
                    </p>
                  )}
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
                      {filteredTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id} disabled={team.id === team1Id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {team2Warning && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-tight font-medium">
                      ⚠️ {team2Warning}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stage & Group Configuration */}
          <div className="space-y-3 rounded-md border p-3 bg-muted/10">
            <div className="space-y-2">
              <Label>Tahap (Stage)</Label>
              <RadioGroup
                value={stage}
                onValueChange={(v) => {
                  setStage(v);
                  if (v === "group") {
                    setPhaseLabel("Group Stage");
                    if (!groupName) setGroupName("A");
                  } else if (phaseLabel === "Group Stage") {
                    setPhaseLabel("Babak Penyisihan");
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="edit-stage-group" value="group" />
                  <Label htmlFor="edit-stage-group" className="font-normal cursor-pointer text-xs">
                    Babak Grup
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="edit-stage-knockout" value="knockout" />
                  <Label htmlFor="edit-stage-knockout" className="font-normal cursor-pointer text-xs">
                    Babak Gugur
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



          {/* Participants Scores */}
          {is17an && match.participants && match.participants.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Skor Peserta</Label>
              <div className="grid gap-3">
                {match.participants.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 font-medium">{p.team?.name || "Peserta"}</div>
                      <div className="w-24">
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
                            className={`h-8 flex-1 gap-1 text-[10px] uppercase font-bold tracking-tighter ${
                              participantRanks[p.id] === r 
                                ? (r === 1 ? 'bg-yellow-500 hover:bg-yellow-600' : r === 2 ? 'bg-slate-400 hover:bg-slate-500' : 'bg-amber-600 hover:bg-amber-700') 
                                : ''
                            }`}
                            onClick={() => setParticipantRanks(prev => ({ ...prev, [p.id]: prev[p.id] === r ? null : r }))}
                          >
                            <Medal className="w-3 h-3" />
                            Juara {r}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-team score and ranking editor (for non-17an match formats) */}
          {!is17an && (
            <div className="space-y-4">
              <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Skor & Hasil Akhir</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold text-xs text-foreground">
                    {allTeams.find((t) => t.id === team1Id)?.name || "Tim 1"}
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
                          className={`h-7 flex-1 gap-1 text-[9px] uppercase font-bold tracking-tighter ${
                            winnerRank1 === r 
                              ? (r === 1 ? 'bg-yellow-500 hover:bg-yellow-600' : r === 2 ? 'bg-slate-400 hover:bg-slate-500' : 'bg-amber-600 hover:bg-amber-700') 
                              : ''
                          }`}
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
                  <Label className="font-semibold text-xs text-foreground">
                    {allTeams.find((t) => t.id === team2Id)?.name || "Tim 2"}
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
                          className={`h-7 flex-1 gap-1 text-[9px] uppercase font-bold tracking-tighter ${
                            winnerRank2 === r 
                              ? (r === 1 ? 'bg-yellow-500 hover:bg-yellow-600' : r === 2 ? 'bg-slate-400 hover:bg-slate-500' : 'bg-amber-600 hover:bg-amber-700') 
                              : ''
                          }`}
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
