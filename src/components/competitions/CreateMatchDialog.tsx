import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useCreateMatch } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails } from "@/types/competition";

interface CreateMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

export function CreateMatchDialog({
  open,
  onOpenChange,
  competition,
}: CreateMatchDialogProps) {
  const [roundNumber, setRoundNumber] = useState("1");
  const [matchNumber, setMatchNumber] = useState("1");
  const [team1Id, setTeam1Id] = useState<string>("");
  const [team2Id, setTeam2Id] = useState<string>("");
  const [matchDatetime, setMatchDatetime] = useState("");
  const [location, setLocation] = useState("");

  const createMutation = useCreateMatch();

  const handleSubmit = () => {
    // Validate required fields
    if (!roundNumber || !matchNumber) {
      alert("Harap isi babak dan nomor pertandingan.");
      return;
    }

    if (team1Id && team2Id && team1Id === team2Id) {
      alert("Tim 1 dan Tim 2 tidak boleh sama.");
      return;
    }

    createMutation.mutate(
      {
        competition_id: competition.id,
        round_number: parseInt(roundNumber, 10),
        match_number: parseInt(matchNumber, 10),
        team1_id: team1Id && team1Id !== "none" ? team1Id : undefined,
        team2_id: team2Id && team2Id !== "none" ? team2Id : undefined,
        match_datetime: matchDatetime || undefined,
        location: location || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          // Reset form
          setRoundNumber("1");
          setMatchNumber("1");
          setTeam1Id("");
          setTeam2Id("");
          setMatchDatetime("");
          setLocation("");
        },
        onError: (error) => {
          console.error("Create failed:", error);
          alert("Gagal membuat pertandingan.");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Pertandingan Baru</DialogTitle>
          <DialogDescription>
            Atur jadwal dan tim untuk pertandingan baru
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              <Label>Nomor Match</Label>
              <Input
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                placeholder="Contoh: 1"
                type="number"
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tim 1</Label>
              <Select value={team1Id} onValueChange={setTeam1Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tim 1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {competition.teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tim 2</Label>
              <Select value={team2Id} onValueChange={setTeam2Id}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Tim 2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {competition.teams?.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
