import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateTeam } from "@/hooks/useCompetitions";
import { useEventHousePayments } from "@/hooks/useEventHousePayments";
import { useToast } from "@/hooks/use-toast";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import {
  getAgeGroup,
  getKidsBracket,
  findBracket,
  formatBracket,
  AGE_GROUP_LABELS,
  AGE_CATEGORY_LABELS,
  type AgeCategory,
  type AgeBracket,
} from "@/lib/age-groups";
import type { EventCompetitionWithDetails } from "@/types/competition";
import type { Profile, House, Event } from "@/types/database";

interface AddTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

export function AddTeamDialog({ open, onOpenChange, competition }: AddTeamDialogProps) {
  const [source, setSource] = useState<"user" | "manual">("user");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [manualName, setManualName] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<string>("");
  const [ageInput, setAgeInput] = useState<string>("");

  const { toast } = useToast();
  const { naturalSort } = useNaturalSort();
  const createTeamMutation = useCreateTeam();

  const ageCategory = (competition.age_category as AgeCategory) || "mixed";

  // Parent event for paid-event status
  const { data: event } = useQuery({
    queryKey: ["event-for-competition", competition.event_id],
    queryFn: async () => {
      if (!competition.event_id) return null;
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", competition.event_id)
        .maybeSingle();
      if (error) throw error;
      return data as Event | null;
    },
    enabled: !!competition.event_id && open,
  });

  const { data: payments } = useEventHousePayments(competition.event_id || undefined);

  const { data: houses } = useQuery({
    queryKey: ["houses-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select("*");
      if (error) throw error;
      return data as House[];
    },
    enabled: open,
  });

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: open,
  });

  const isPaidEvent = !!event?.is_paid_event;
  const paidHouseIds = useMemo(
    () => new Set((payments || []).map((p) => p.house_id)),
    [payments]
  );

  const sortedHouses = useMemo(() => {
    if (!houses) return [];
    return [...houses].sort((a, b) =>
      naturalSort(`${a.block}-${a.number}`, `${b.block}-${b.number}`)
    );
  }, [houses, naturalSort]);

  // Houses that satisfy payment requirement (registration is still allowed even if
  // other participants from the same house exist, since each registration is individual).
  const eligibleHouses = useMemo(() => {
    return sortedHouses.filter((h) => {
      if (isPaidEvent && !paidHouseIds.has(h.id)) return false;
      return true;
    });
  }, [sortedHouses, isPaidEvent, paidHouseIds]);

  useEffect(() => {
    if (!open) {
      setSource("user");
      setSelectedProfileId("");
      setManualName("");
      setSelectedHouse("");
      setAgeInput("");
    }
  }, [open]);

  const houseLabel = (id: string) => {
    const h = houses?.find((x) => x.id === id);
    return h ? `Blok ${h.block} No. ${h.number}` : "";
  };

  const ageValue = ageInput.trim() === "" ? null : Number(ageInput.replace(",", "."));
  const ageGroup = ageValue != null && !isNaN(ageValue) ? getAgeGroup(ageValue) : null;
  const customBrackets: AgeBracket[] | null = Array.isArray(competition.kids_brackets)
    ? (competition.kids_brackets as AgeBracket[])
    : null;
  const kidsBracket =
    ageValue != null && !isNaN(ageValue) && ageGroup === "kids"
      ? customBrackets && customBrackets.length > 0
        ? (findBracket(ageValue, customBrackets)
            ? formatBracket(findBracket(ageValue, customBrackets)!)
            : `Di luar grup (${ageValue} thn)`)
        : getKidsBracket(ageValue)
      : null;

  const categoryMismatch =
    ageGroup && ageCategory !== "mixed" && ageGroup !== ageCategory;

  const selectedProfile = profiles?.find((p) => p.id === selectedProfileId);
  const finalName =
    source === "user" ? selectedProfile?.full_name?.trim() || "" : manualName.trim();

  const handleSubmit = async () => {
    if (!finalName) {
      toast({
        variant: "destructive",
        title: "Nama peserta wajib diisi",
      });
      return;
    }
    if (!selectedHouse) {
      toast({
        variant: "destructive",
        title: "Nomor rumah wajib dipilih",
        description: "Setiap peserta harus terhubung ke nomor rumah.",
      });
      return;
    }
    if (isPaidEvent && !paidHouseIds.has(selectedHouse)) {
      toast({
        variant: "destructive",
        title: "Rumah belum membayar",
        description: "Hanya rumah yang sudah lunas yang bisa didaftarkan.",
      });
      return;
    }
    if (ageValue == null || isNaN(ageValue) || ageValue < 0) {
      toast({
        variant: "destructive",
        title: "Umur wajib diisi",
        description: "Masukkan umur peserta untuk pengelompokan yang adil.",
      });
      return;
    }
    if (categoryMismatch) {
      toast({
        variant: "destructive",
        title: "Umur tidak sesuai kategori",
        description: `Kompetisi ini untuk kategori ${AGE_CATEGORY_LABELS[ageCategory]}.`,
      });
      return;
    }

    const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
    const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

    createTeamMutation.mutate(
      {
        competition_id: competition.id,
        name: finalName,
        house_id: selectedHouse,
        seed_number: nextSeed,
        participant_name: finalName,
        user_id: source === "user" ? selectedProfileId : null,
        age: ageValue,
        age_group: ageGroup,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  const isPending = createTeamMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pendaftaran Peserta</DialogTitle>
          <DialogDescription>
            Kategori: <span className="font-medium">{AGE_CATEGORY_LABELS[ageCategory]}</span>
            {isPaidEvent && " · Rumah harus sudah membayar."}
          </DialogDescription>
        </DialogHeader>

        {isPaidEvent && (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Acara Berbayar</AlertTitle>
            <AlertDescription>
              {paidHouseIds.size} rumah sudah membayar. Hanya rumah lunas dapat didaftarkan.
            </AlertDescription>
          </Alert>
        )}

        {eligibleHouses.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Tidak ada rumah yang bisa didaftarkan</AlertTitle>
            <AlertDescription>
              {isPaidEvent
                ? "Tandai pembayaran rumah dulu di menu Kelola Pembayaran."
                : "Belum ada rumah terdaftar di sistem."}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          <div className="space-y-2">
            <Label>Sumber Peserta</Label>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as "user" | "manual")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="src-user" value="user" />
                <Label htmlFor="src-user" className="font-normal cursor-pointer">
                  Warga Terdaftar
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="src-manual" value="manual" />
                <Label htmlFor="src-manual" className="font-normal cursor-pointer">
                  Manual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {source === "user" ? (
            <div className="space-y-2">
              <Label>Pilih Warga <span className="text-destructive">*</span></Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih warga" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || "(tanpa nama)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manual-name">
                Nama Peserta <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manual-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nama peserta"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Nomor Rumah <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedHouse} onValueChange={setSelectedHouse}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih rumah" />
              </SelectTrigger>
              <SelectContent>
                {eligibleHouses.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Tidak ada rumah tersedia
                  </div>
                ) : (
                  eligibleHouses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      Blok {h.block} No. {h.number}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="age">
              Umur (tahun) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="age"
              type="text"
              inputMode="decimal"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              placeholder="contoh: 1.6, 7, 25"
            />
            <p className="text-xs text-muted-foreground">
              Gunakan desimal untuk anak-anak (mis. 1.6 = 1 thn 7 bln).
            </p>
            {ageGroup && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary">
                  Kategori: {AGE_GROUP_LABELS[ageGroup]}
                </Badge>
                {kidsBracket && (
                  <Badge variant="outline">Grup Anak: {kidsBracket}</Badge>
                )}
              </div>
            )}
            {categoryMismatch && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Umur tidak masuk kategori {AGE_CATEGORY_LABELS[ageCategory]} untuk kompetisi ini.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !finalName ||
              !selectedHouse ||
              ageValue == null ||
              isNaN(ageValue) ||
              !!categoryMismatch
            }
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Daftarkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
