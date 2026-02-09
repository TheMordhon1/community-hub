import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { useUpdateMatch } from "@/hooks/useCompetitions";
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
  const [winnerId, setWinnerId] = useState<string>("");
  const [status, setStatus] = useState<MatchStatus>("scheduled");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const updateMutation = useUpdateMatch();

  useEffect(() => {
    if (match) {
      setScore1(match.score1 || "");
      setScore2(match.score2 || "");
      setWinnerId(match.winner_id || "");
      setStatus(match.status);
      setLocation(match.location || "");
      setNotes(match.notes || "");
    }
  }, [match]);

  const handleSubmit = () => {
    // Validate required fields
    if (!score1 || !score2 || !winnerId) {
      alert("Please fill in all required fields.");
      return;
    }

    if (!match) return;

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
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (error) => {
          console.error("Update failed:", error);
          alert("Failed to update match.");
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
            {match.team1?.name || "TBD"} vs {match.team2?.name || "TBD"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{match.team1?.name || "Tim 1"}</Label>
              <Input
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                placeholder="Skor"
                type="number" // Ensure only numbers are entered
              />
            </div>
            <div className="space-y-2">
              <Label>{match.team2?.name || "Tim 2"}</Label>
              <Input
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                placeholder="Skor"
                type="number" // Ensure only numbers are entered
              />
            </div>
          </div>

          {/* Winner */}
          <div className="space-y-2">
            <Label>Pemenang</Label>
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
