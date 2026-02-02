import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  eventId?: string;
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
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);

  const { data: events, isLoading: isLoadingEvents } = useQuery({
    queryKey: ["all-events-for-selection"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title")
        .order("event_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !eventId && open,
  });

  const createMutation = useCreateCompetition();
  const updateMutation = useUpdateCompetition();

  const isEditing = !!editingCompetition;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const resetForm = useCallback(() => {
    setSportName("");
    setFormat("knockout");
    setMatchType("1v1");
    setParticipantType("user");
    setRules("");
    setMaxParticipants("");
    setSelectedEventId(eventId);
  }, [eventId]);

  useEffect(() => {
    if (editingCompetition) {
      setSportName(editingCompetition.sport_name);
      setFormat(editingCompetition.format);
      setMatchType(editingCompetition.match_type);
      setParticipantType(editingCompetition.participant_type);
      setRules(editingCompetition.rules || "");
      setMaxParticipants(editingCompetition.max_participants?.toString() || "");
      setSelectedEventId(editingCompetition.event_id);
    } else {
      resetForm();
    }
  }, [editingCompetition, open, eventId, resetForm]);

  const handleSubmit = () => {
    if (!sportName.trim() || (!selectedEventId && !eventId)) return;

    const data = {
      sport_name: sportName,
      format,
      match_type: matchType,
      participant_type: participantType,
      rules: rules || undefined,
      max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
    };

    const finalEventId = eventId || selectedEventId;
    if (!finalEventId) return;

    if (isEditing) {
      updateMutation.mutate(
        { id: editingCompetition.id, event_id: finalEventId, ...data },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createMutation.mutate(
        { event_id: finalEventId, ...data },
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
          {!eventId && !isEditing && (
            <div className="space-y-2">
              <Label>Pilih Acara *</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingEvents ? "Memuat acara..." : "Pilih acara terkait"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm">Memuat acara...</span>
                    </div>
                  ) : events && events.length > 0 ? (
                    events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Belum ada acara. Buat acara terlebih dahulu di tab Acara.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

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
          <Button
            onClick={handleSubmit}
            disabled={
              !sportName.trim() ||
              (!eventId && !selectedEventId) ||
              isPending
            }
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? "Simpan" : "Buat Kompetisi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
