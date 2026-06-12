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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Users, Sparkles, Shuffle, MousePointerClick } from "lucide-react";
import { useCreateMatch } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import { SpinWheelDialog } from "@/components/competitions/SpinWheelDialog";
import { useAssignMatchTeams } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails } from "@/types/competition";

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

  const is17an = competition.format === "17an";
  const allTeams = competition.teams || [];

  useEffect(() => {
    if (open) {
      setMaxParticipants(is17an ? "3" : "2");
      setSelectionMode("manual");
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
    }
  }, [open, competition.events, is17an]);

  const createMutation = useCreateMatch();
  const assignTeams = useAssignMatchTeams();

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  };

  const targetCount = Math.max(1, parseInt(maxParticipants, 10) || 1);

  const handleSubmit = () => {
    if (!roundNumber || !matchNumber) {
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
        if (team1Id && team1Id !== "none" && team2Id && team2Id !== "none" && team1Id === team2Id) {
          toast({
            variant: "destructive",
            title: "Kesalahan Tim",
            description: "Tim 1 dan Tim 2 tidak boleh sama.",
          });
          return;
        }
        if (team1Id && team1Id !== "none") teamIds.push(team1Id);
        if (team2Id && team2Id !== "none") teamIds.push(team2Id);
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
        round_number: parseInt(roundNumber, 10),
        match_number: parseInt(matchNumber, 10),
        team1_id: !is17an && selectionMode === "manual" && team1Id && team1Id !== "none" ? team1Id : undefined,
        team2_id: !is17an && selectionMode === "manual" && team2Id && team2Id !== "none" ? team2Id : undefined,
        team_ids:
          selectionMode === "random"
            ? teamIds
            : selectionMode === "manual" && is17an
              ? teamIds
              : undefined,
        match_datetime: matchDatetime || undefined,
        location: location || undefined,
        max_participants: targetCount,
        age_bracket_min:
          bracketMin.trim() === "" ? null : Number(bracketMin.replace(",", ".")),
        age_bracket_max:
          bracketMax.trim() === "" ? null : Number(bracketMax.replace(",", ".")),
        age_bracket_label: bracketLabel.trim() || null,
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tim 1</Label>
                    <Select value={team1Id} onValueChange={setTeam1Id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Tim 1" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belum ditentukan</SelectItem>
                        {allTeams.map((team) => (
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
                        {allTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
