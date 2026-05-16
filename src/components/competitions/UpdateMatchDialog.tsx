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
import { Loader2, Trophy, Medal } from "lucide-react";
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
  }, [match]);

  const handleSubmit = () => {
    if (!match) return;

    const participantsData = (match.participants && match.participants.length > 0)
      ? match.participants.map(p => ({
          id: p.id,
          team_id: p.team_id,
          score: participantScores[p.id] || null,
          is_winner: participantWinners[p.id] || (participantRanks[p.id] === 1),
          winner_rank: participantRanks[p.id] || null,
        }))
      : (() => {
          // If no participants records yet, create them via team_ids
          const res = [];
          if (match.team1_id) {
            res.push({
              team_id: match.team1_id,
              score: score1 || null,
              is_winner: winnerId === match.team1_id || winnerRank1 === 1,
              winner_rank: winnerRank1
            });
          }
          if (match.team2_id) {
            res.push({
              team_id: match.team2_id,
              score: score2 || null,
              is_winner: winnerId === match.team2_id || winnerRank2 === 1,
              winner_rank: winnerRank2
            });
          }
          return res.length > 0 ? res : undefined;
        })();

    updateMutation.mutate(
      {
        id: match.id,
        competition_id: competition.id,
        score1: score1 || null,
        score2: score2 || null,
        winner_id: winnerId || null,
        status,
        location: location || null,
        notes: notes || null,
        phase_label: phaseLabel || null,
        match_datetime: matchDatetime || null,
        is_point: isPoint,
        is_final: isFinal,
        participant_scores: participantsData,
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
          <div className="space-y-2">
            <Label htmlFor="phase-label">Nama Babak (Fase)</Label>
            <Input
              id="phase-label"
              value={phaseLabel}
              onChange={(e) => setPhaseLabel(e.target.value)}
              placeholder="Contoh: Babak 1, Final, dll."
            />
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

          {/* Participants Scores */}
          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Skor Peserta</Label>
            <div className="grid gap-3">
              {match.participants?.map((p) => (
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
                  </div>
              ))}
              
              {(!match.participants || match.participants.length === 0) && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{match.team1?.name || "Tim 1"}</Label>
                      <Input
                        value={score1}
                        onChange={(e) => setScore1(e.target.value)}
                        placeholder="Skor"
                        type="number"
                      />
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
                                if (r === 1 && winnerRank1 !== r) setWinnerId(match.team1_id || "");
                            }}
                          >
                            Juara {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{match.team2?.name || "Tim 2"}</Label>
                      <Input
                        value={score2}
                        onChange={(e) => setScore2(e.target.value)}
                        placeholder="Skor"
                        type="number"
                      />
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
                                if (r === 1 && winnerRank2 !== r) setWinnerId(match.team2_id || "");
                            }}
                          >
                            Juara {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Winner (Standard fallback) */}
          {(!match.participants || match.participants.length === 0) && (
            <div className="space-y-2">
              <Label>Pemenang Utama</Label>
              <Select value={winnerId} onValueChange={setWinnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pemenang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Belum ditentukan</SelectItem>
                  {match.team1_id && (
                    <SelectItem value={match.team1_id}>
                      {match.team1?.name || "Tim 1"}
                    </SelectItem>
                  )}
                  {match.team2_id && (
                    <SelectItem value={match.team2_id}>
                      {match.team2?.name || "Tim 2"}
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
