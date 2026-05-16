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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users } from "lucide-react";
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
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [matchDatetime, setMatchDatetime] = useState("");
  const [location, setLocation] = useState("");

  const is17an = competition.format === "17an";

  useEffect(() => {
    if (open) {
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
      // Reset on close
      setRoundNumber("1");
      setMatchNumber("1");
      setTeam1Id("");
      setTeam2Id("");
      setSelectedTeamIds([]);
      setMatchDatetime("");
      setLocation("");
    }
  }, [open, competition.events]);

  const createMutation = useCreateMatch();

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId) 
        : [...prev, teamId]
    );
  };

  const handleSubmit = () => {
    if (!roundNumber || !matchNumber) {
      alert("Harap isi babak dan nomor pertandingan.");
      return;
    }

    if (!is17an && team1Id && team2Id && team1Id === team2Id) {
      alert("Tim 1 dan Tim 2 tidak boleh sama.");
      return;
    }

    if (is17an && selectedTeamIds.length === 0) {
      alert("Pilih minimal satu tim untuk pertandingan.");
      return;
    }

    createMutation.mutate(
      {
        competition_id: competition.id,
        round_number: parseInt(roundNumber, 10),
        match_number: parseInt(matchNumber, 10),
        team1_id: !is17an && team1Id && team1Id !== "none" ? team1Id : undefined,
        team2_id: !is17an && team2Id && team2Id !== "none" ? team2Id : undefined,
        team_ids: is17an ? selectedTeamIds : undefined,
        match_datetime: matchDatetime || undefined,
        location: location || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {is17an ? "Buat Sesi/Lomba Baru" : "Buat Pertandingan Baru"}
          </DialogTitle>
          <DialogDescription>
            {is17an 
              ? "Atur jadwal dan pilih peserta untuk sesi lomba ini" 
              : "Atur jadwal dan tim untuk pertandingan baru"}
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

          {is17an ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Pilih Peserta ({selectedTeamIds.length})
              </Label>
              <div className="border rounded-md p-2 space-y-2 max-h-48 overflow-y-auto bg-muted/20">
                {competition.teams?.map((team) => (
                  <div key={team.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded transition-colors">
                    <Checkbox 
                      id={`team-${team.id}`}
                      checked={selectedTeamIds.includes(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                    />
                    <Label 
                      htmlFor={`team-${team.id}`}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {team.name}
                    </Label>
                  </div>
                ))}
                {(!competition.teams || competition.teams.length === 0) && (
                  <p className="text-xs text-muted-foreground p-4 text-center">
                    Belum ada peserta terdaftar. Tambahkan peserta terlebih dahulu.
                  </p>
                )}
              </div>
            </div>
          ) : (
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
