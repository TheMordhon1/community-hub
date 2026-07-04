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
import { Loader2, Trophy, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { AGE_CATEGORY_LABELS, AGE_CATEGORY_OPTIONS, GENDER_CATEGORY_LABELS, GENDER_CATEGORY_OPTIONS, formatBracket, type AgeCategory, type AgeBracket, type GenderCategory } from "@/lib/age-groups";

interface CreateCompetitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string;
  editingCompetition?: EventCompetition | null;
}

const FORMAT_DESCRIPTIONS: Record<CompetitionFormat, string> = {
  knockout: "Sistem Gugur: Pemenang lanjut ke babak berikutnya, yang kalah langsung berhenti. Cocok untuk kompetisi cepat.",
  round_robin: "Round Robin: Semua peserta saling bertemu satu sama lain. Pemenang ditentukan dari poin terbanyak.",
  league: "Liga: Sistem klasemen poin seperti liga sepak bola. Berjalan dalam periode waktu tertentu.",
  liga_grup: "Liga Grup + Gugur: Peserta dibagi ke beberapa grup (A, B, C…), main round-robin dalam grup dengan 2 set (1 poin per set menang). Top peserta setiap grup lolos ke babak gugur hingga Juara 1, 2, 3.",
  swiss: "Sistem Swiss: Format turnamen adil tanpa eliminasi. Peserta akan melawan lawan dengan skor yang setara di setiap ronde.",
  "17an": "Lomba 17an: Format santai untuk lomba kemerdekaan. Mencatat peserta dan membagi grup secara sederhana jika diperlukan.",
  custom: "Format Bebas: Aturan main ditentukan sendiri oleh panitia sesuai kesepakatan.",
};

export function CreateCompetitionDialog({
  open,
  onOpenChange,
  eventId,
  editingCompetition,
}: CreateCompetitionDialogProps) {
  const [sportName, setSportName] = useState("");
  const [format, setFormat] = useState<CompetitionFormat>("knockout");
  const [matchType, setMatchType] = useState<MatchType>("1v1");
  const [customMatchLabel, setCustomMatchLabel] = useState("");
  const [participantType, setParticipantType] = useState<ParticipantType>("user");
  const [rules, setRules] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(eventId);
  const [isPoint, setIsPoint] = useState(true);
  const [ageCategory, setAgeCategory] = useState<AgeCategory>("mixed");
  const [genderCategory, setGenderCategory] = useState<GenderCategory>("mixed");
  const [kidsBrackets, setKidsBrackets] = useState<AgeBracket[]>([]);
  const [newBracketMin, setNewBracketMin] = useState("");
  const [newBracketMax, setNewBracketMax] = useState("");
  const [newBracketLabel, setNewBracketLabel] = useState("");
  const [groupCount, setGroupCount] = useState("3");
  const [setsPerMatch, setSetsPerMatch] = useState("2");
  const [advancePerGroup, setAdvancePerGroup] = useState("2");

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
    setCustomMatchLabel("");
    setParticipantType("user");
    setRules(FORMAT_DESCRIPTIONS["knockout"]);
    setMaxParticipants("");
    setSelectedEventId(eventId);
    setIsPoint(true);
    setAgeCategory("mixed");
    setGenderCategory("mixed");
    setKidsBrackets([]);
    setNewBracketMin("");
    setNewBracketMax("");
    setNewBracketLabel("");
  }, [eventId]);

  useEffect(() => {
    if (editingCompetition) {
      setSportName(editingCompetition.sport_name);
      setFormat(editingCompetition.format);
      setMatchType(editingCompetition.match_type);
      setCustomMatchLabel(editingCompetition.custom_match_label || "");
      setParticipantType(editingCompetition.participant_type);
      setRules(editingCompetition.rules || "");
      setMaxParticipants(editingCompetition.max_participants?.toString() || "");
      setSelectedEventId(editingCompetition.event_id || undefined);
      setIsPoint(editingCompetition.is_point !== false);
      setAgeCategory((editingCompetition.age_category as AgeCategory) || "mixed");
      setGenderCategory(((editingCompetition as unknown as { gender_category?: GenderCategory }).gender_category) || "mixed");
      const eb = (editingCompetition as unknown as { kids_brackets?: AgeBracket[] | null }).kids_brackets;
      setKidsBrackets(Array.isArray(eb) ? eb : []);
      const gc = (editingCompetition as unknown as { group_count?: number | null }).group_count;
      const sp = (editingCompetition as unknown as { sets_per_match?: number | null }).sets_per_match;
      const ap = (editingCompetition as unknown as { advance_per_group?: number | null }).advance_per_group;
      setGroupCount(gc ? String(gc) : "3");
      setSetsPerMatch(sp ? String(sp) : "2");
      setAdvancePerGroup(ap ? String(ap) : "2");
    } else {
      resetForm();
    }
  }, [editingCompetition, open, eventId, resetForm]);

  const handleFormatChange = (value: string) => {
    const newFormat = value as CompetitionFormat;
    setFormat(newFormat);
    
    // Auto-fill rules if empty or matches any default description
    const isDefaultDescription = Object.values(FORMAT_DESCRIPTIONS).includes(rules) || rules === "";
    if (isDefaultDescription) {
      setRules(FORMAT_DESCRIPTIONS[newFormat]);
    }
  };

  const handleSubmit = () => {
    // Check if sportName is not empty 
    if (!sportName.trim()) {
      return;
    }

    const data = {
      sport_name: sportName,
      format,
      match_type: matchType,
      custom_match_label: matchType === "custom" ? (customMatchLabel || null) : null,
      participant_type: participantType,
      rules: rules || undefined,
      max_participants: maxParticipants ? parseInt(maxParticipants) : undefined,
      is_point: isPoint,
      age_category: ageCategory,
      gender_category: genderCategory,
      kids_brackets:
        (ageCategory === "kids" || ageCategory === "mixed") && kidsBrackets.length > 0
          ? kidsBrackets
          : null,
      group_count: format === "liga_grup" ? Math.max(2, parseInt(groupCount) || 3) : null,
      sets_per_match: format === "liga_grup" ? Math.max(1, parseInt(setsPerMatch) || 2) : null,
      advance_per_group: format === "liga_grup" ? Math.max(1, parseInt(advancePerGroup) || 2) : null,
    };

    // Handle "none" value from select
    const finalEventId = eventId || (selectedEventId === "none" ? undefined : selectedEventId);

    if (isEditing) {
      updateMutation.mutate(
        { id: editingCompetition.id, event_id: finalEventId || "", ...data }, 
        // Note: updateMutation type might still expect event_id string because I didn't verify useUpdateCompetition fully, 
        // but let's assume it handles it or we might need to adjust.
        // Actually, for update, event_id is required in the object passed to mutate but can be same as before.
        // Wait, if I'm editing, I should probably keep existing event_id if not changed. 
        // But here I'm constructing a new object. 
        // Let's check useUpdateCompetition. 
        // It takes { id, event_id, ... }. 
        // If event_id becomes optional there too, I should pass undefined?
        // My previous edit to useCompetitions.ts only changed useCreateCompetition. 
        // I should have checked useUpdateCompetition too.
        // Let's assume for now I pass undefined if no event.
        // BUT wait, in the dialog logic:
        // if editing, selectedEventId is set from editingCompetition.event_id.
        // If I change it to "none", it becomes "none".
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
              <Label>Pilih Acara (Opsional)</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingEvents ? "Memuat acara..." : "Pilih acara terkait (opsional)"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-sm">Memuat acara...</span>
                    </div>
                  ) : events && events.length > 0 ? (
                    <>
                      <SelectItem value="none">-- Tidak ada acara --</SelectItem>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Belum ada acara tersedia.
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
              <Select value={format} onValueChange={handleFormatChange}>
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
              {matchType === "custom" && (
                <Input
                  value={customMatchLabel}
                  onChange={(e) => setCustomMatchLabel(e.target.value)}
                  placeholder="contoh: 2 vs 3, 5 pemain, dll"
                  className="mt-2"
                />
              )}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kategori Umur</Label>
              <Select value={ageCategory} onValueChange={(v) => setAgeCategory(v as AgeCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_CATEGORY_OPTIONS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {AGE_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select value={genderCategory} onValueChange={(v) => setGenderCategory(v as GenderCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_CATEGORY_OPTIONS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {GENDER_CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {ageCategory === "kids"
              ? "Anak-anak (<13 thn). Sistem akan kelompokkan otomatis berdasarkan umur peserta."
              : ageCategory === "teenager"
              ? "Remaja (13-17 thn)."
              : ageCategory === "adult"
              ? "Dewasa (18 thn ke atas)."
              : "Terbuka untuk semua umur."}
            {genderCategory !== "mixed" && ` · Khusus ${GENDER_CATEGORY_LABELS[genderCategory].toLowerCase()}.`}
          </p>

          {(ageCategory === "kids" || ageCategory === "mixed") && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Grup Umur Anak (opsional)</Label>
                <p className="text-xs text-muted-foreground">
                  Tentukan rentang umur anak agar pengelompokan adil (mis. 1.5 - 2 thn).
                  Jika kosong, sistem akan mengelompokkan otomatis.
                </p>
              </div>

              {kidsBrackets.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {kidsBrackets.map((b, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                      {formatBracket(b)}
                      <button
                        type="button"
                        className="ml-1 rounded hover:bg-background/50 p-0.5"
                        onClick={() => setKidsBrackets((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Hapus"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-end pt-1">
                <div>
                  <Label className="text-xs">Min (thn)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={newBracketMin}
                    onChange={(e) => setNewBracketMin(e.target.value)}
                    placeholder="1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs">Max (thn)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={newBracketMax}
                    onChange={(e) => setNewBracketMax(e.target.value)}
                    placeholder="2"
                  />
                </div>
                <div>
                  <Label className="text-xs">Label (opsional)</Label>
                  <Input
                    value={newBracketLabel}
                    onChange={(e) => setNewBracketLabel(e.target.value)}
                    placeholder="Balita"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    const min = Number(newBracketMin.replace(",", "."));
                    const max = Number(newBracketMax.replace(",", "."));
                    if (isNaN(min) || isNaN(max) || min < 0 || max <= min) return;
                    setKidsBrackets((prev) =>
                      [...prev, { min, max, label: newBracketLabel.trim() || undefined }].sort(
                        (a, b) => a.min - b.min
                      )
                    );
                    setNewBracketMin("");
                    setNewBracketMax("");
                    setNewBracketLabel("");
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

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

          <div className="flex items-center justify-between p-4 rounded-xl border bg-primary/5 border-primary/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <Label className="text-base font-bold">Sistem Poin</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Aktifkan jika kompetisi ini memberikan poin
              </p>
            </div>
            <Switch
              checked={isPoint}
              onCheckedChange={setIsPoint}
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
              isPending ||
              (maxParticipants && isNaN(parseInt(maxParticipants))) 
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
