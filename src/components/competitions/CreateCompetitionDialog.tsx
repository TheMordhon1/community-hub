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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateCompetition, useUpdateCompetition } from "@/hooks/useCompetitions";
import type { 
  EventCompetition, 
  CompetitionFormat, 
  MatchType, 
  ParticipantType 
} from "@/types/competition";
import {
  FORMAT_LABELS,
  MATCH_TYPE_LABELS,
  PARTICIPANT_TYPE_LABELS,
} from "@/types/competition";

interface CreateCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  editingCompetition?: EventCompetition | null;
}

export function CreateCompetitionDialog({
  open,
  onOpenChange,
  eventId,
  editingCompetition,
}: CreateCompetitionDialogProps) {
  const [sportName, setSportName] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("knockout");
  const [matchType, setMatchType] = useState<MatchType>("1v1");
  const [participantType, setParticipantType] = useState<ParticipantType>("user");
  const [rules, setRules] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  const createMutation = useCreateCompetition();
  const updateMutation = useUpdateCompetition();

  const isEditing = !!editingCompetition;
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (editingCompetition) {
      setSportName(editingCompetition.sport_name);
      setFormat(editingCompetition.format);
      setMatchType(editingCompetition.match_type);
      setParticipantType(editingCompetition.participant_type);
      setRules(editingCompetition.rules || "");
      setMaxParticipants(editingCompetition.max_participants?.toString() || "");
    } else {
      resetForm();
    }
  }, [editingCompetition, open]);

  const resetForm = () => {
    setSportName("");
    setFormat("knockout");
    setMatchType("1v1");
    setParticipantType("user");
    setRules("");
    setMaxParticipants("");
  };

  const handleSubmit = () => {
    if (!sportName.trim()) return;

    const data = {
      sport_name: sportName,
      format,
      match_type: matchType,
      participant_type: participantType,
      rules: rules || undefined,
      max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: editingCompetition.id, event_id: eventId, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createMutation.mutate(
        { event_id: eventId, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Kompetisi" : "Tambah Kompetisi"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Perbarui detail kompetisi"
              : "Buat kompetisi baru untuk acara ini"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sport-name">Nama Olahraga/Permainan *</Label>
            <Input
              id="sport-name"
              value={sportName}
              onChange={(e) => setSportName(e.target.value)}
              placeholder="contoh: Badminton, Futsal, Catur"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as CompetitionFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipe Pertandingan</Label>
              <Select value={matchType} onValueChange={(v) => setMatchType(v as MatchType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipe Peserta</Label>
            <Select value={participantType} onValueChange={(v) => setParticipantType(v as ParticipantType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PARTICIPANT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-participants">Maks. Peserta (opsional)</Label>
            <Input
              id="max-participants"
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="contoh: 16"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rules">Peraturan (opsional)</Label>
            <Textarea
              id="rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Tulis peraturan kompetisi..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!sportName.trim() || isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Simpan" : "Buat Kompetisi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
