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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useCreateTeam } from "@/hooks/useCompetitions";
import { useEventHousePayments } from "@/hooks/useEventHousePayments";
import { useToast } from "@/hooks/use-toast";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import {
  getAgeGroup,
  getKidsBracket,
  findBracket,
  formatBracket,
  isGenderMatchingCategory,
  AGE_GROUP_LABELS,
  AGE_CATEGORY_LABELS,
  GENDER_CATEGORY_LABELS,
  GENDER_LABELS,
  type AgeCategory,
  type AgeBracket,
  type GenderCategory,
  type Gender,
} from "@/lib/age-groups";
import type { EventCompetitionWithDetails } from "@/types/competition";
import { COUNTRIES, getFlagImgUrl } from "@/lib/countries";
import type { Profile, House, Event } from "@/types/database";

import { MemberAvatarSelector } from "./MemberAvatarSelector";

const parseMemberName = (rawName: string | null | undefined) => {
  if (!rawName) return { name: "", avatarUrl: "" };
  const parts = rawName.split("||");
  return {
    name: parts[0] || "",
    avatarUrl: parts[1] || ""
  };
};

const serializeMemberName = (name: string, avatarUrl: string) => {
  const trimmedName = name.trim();
  const trimmedAvatar = avatarUrl.trim();
  if (!trimmedAvatar) return trimmedName;
  return `${trimmedName}||${trimmedAvatar}`;
};

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
  const [gender, setGender] = useState<Gender | "">("");

  const { toast } = useToast();
  const { naturalSort } = useNaturalSort();
  const createTeamMutation = useCreateTeam();

  const teamSize = useMemo(() => {
    switch (competition?.match_type) {
      case "1v1": return 1;
      case "2v2": return 2;
      case "3v3": return 3;
      case "5v5": return 5;
      case "11v11": return 11;
      default: return 1;
    }
  }, [competition?.match_type]);

  const isTeam = teamSize > 1;
  const [regMode, setRegMode] = useState<"team" | "individual">("team");
  const isActualTeamMode = isTeam && regMode === "team";

  const [members, setMembers] = useState<{ source: "user" | "manual"; profileId: string; name: string; avatarUrl: string; houseBlock: string; houseNumber: string }[]>(
    () => Array.from({ length: teamSize }, () => ({ source: "user", profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" }))
  );
  const [singleAvatarUrl, setSingleAvatarUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamFlag, setTeamFlag] = useState("");
  const [flagSearch, setFlagSearch] = useState("");
  const [isFlagPopoverOpen, setIsFlagPopoverOpen] = useState(false);
  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(flagSearch.toLowerCase())
    );
  }, [flagSearch]);
  const [submitting, setSubmitting] = useState(false);

  const ageCategory = (competition.age_category as AgeCategory) || "mixed";
  const genderCategory = ((competition as unknown as { gender_category?: GenderCategory }).gender_category) || "mixed";
  const is17an = competition.format === "17an";


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
    if (open) {
      setRegMode(isTeam ? "team" : "individual");
      setMembers(Array.from({ length: teamSize }, () => ({ source: "user" as const, profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" })));
      setSingleAvatarUrl("");
      setTeamName("");
      setTeamFlag("");
      setFlagSearch("");
      setSubmitting(false);
    } else {
      setSource("user");
      setSelectedProfileId("");
      setManualName("");
      setSingleAvatarUrl("");
      setSelectedHouse("");
      setAgeInput("");
      setGender("");
      setTeamFlag("");
      setFlagSearch("");
    }
  }, [open, teamSize, isTeam]);

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

  const hasBrackets = !!customBrackets && customBrackets.length > 0;
  // Age is required when the competition targets kids, or when the organizer has
  // defined age brackets (registration must fall inside one of them).
  const requireAge = ageCategory === "kids" || hasBrackets;
  const matchedBracket =
    hasBrackets && ageValue != null && !isNaN(ageValue)
      ? findBracket(ageValue, customBrackets)
      : null;
  const bracketMismatch = hasBrackets && ageValue != null && !isNaN(ageValue) && !matchedBracket;

  const categoryMismatch =
    ageGroup && ageCategory !== "mixed" && ageGroup !== ageCategory;
  const genderMismatch =
    genderCategory !== "mixed" && gender !== "" && !isGenderMatchingCategory(gender as Gender, genderCategory);


  const selectedProfile = profiles?.find((p) => p.id === selectedProfileId);
  const finalName =
    source === "user" ? selectedProfile?.full_name?.trim() || "" : manualName.trim();

  const memberNames = useMemo(() => {
    return members.map((m) => {
      if (m.source === "user") {
        const prof = profiles?.find((p) => p.id === m.profileId);
        return prof?.full_name?.trim() || "";
      }
      return m.name.trim();
    });
  }, [members, profiles]);

  const finalParticipantName = isActualTeamMode
    ? memberNames.filter(Boolean).join(" & ")
    : finalName;

  const finalTeamName = isActualTeamMode
    ? (teamName.trim() || finalParticipantName)
    : finalParticipantName;

  const isFormInvalid = isActualTeamMode
    ? memberNames.some((name) => !name)
    : !finalName;

  const handleSubmit = async () => {
    if (isActualTeamMode) {
      const hasEmptyMember = memberNames.some((name) => !name);
      if (hasEmptyMember) {
        toast({
          variant: "destructive",
          title: "Nama anggota wajib diisi",
          description: `Harap lengkapi semua ${teamSize} nama anggota tim.`,
        });
        return;
      }

      const hasEmptyManualHouseDetails = members.some(m =>
        m.source === "manual" && (!m.houseBlock?.trim() || !m.houseNumber?.trim())
      );
      if (hasEmptyManualHouseDetails) {
        toast({
          variant: "destructive",
          title: "Blok & Nomor Rumah anggota wajib diisi",
          description: "Harap lengkapi blok dan nomor rumah untuk semua anggota manual.",
        });
        return;
      }
    } else {
      if (!finalName) {
        toast({
          variant: "destructive",
          title: "Nama peserta wajib diisi",
        });
        return;
      }
    }
    if (!isTeam && isPaidEvent) {
      if (!selectedHouse) {
        toast({
          variant: "destructive",
          title: "Nomor rumah wajib dipilih",
          description: "Untuk event berbayar, nomor rumah wajib dipilih.",
        });
        return;
      }
      if (!paidHouseIds.has(selectedHouse)) {
        toast({
          variant: "destructive",
          title: "Rumah belum membayar",
          description: "Hanya rumah yang sudah lunas yang bisa didaftarkan.",
        });
        return;
      }
    }
    if (requireAge && !isActualTeamMode && (ageValue == null || isNaN(ageValue) || ageValue < 0)) {
      toast({
        variant: "destructive",
        title: "Umur wajib diisi",
        description: hasBrackets
          ? "Umur diperlukan untuk menentukan grup umur peserta."
          : "Masukkan umur peserta yang valid.",
      });
      return;
    }
    if (!isActualTeamMode && bracketMismatch) {
      toast({
        variant: "destructive",
        title: "Umur di luar grup umur",
        description: `Grup umur tersedia: ${(customBrackets || []).map(formatBracket).join(", ")}.`,
      });
      return;
    }
    if (ageCategory === "kids" && categoryMismatch) {
      toast({
        variant: "destructive",
        title: "Umur tidak sesuai kategori",
        description: `Kompetisi ini untuk kategori ${AGE_CATEGORY_LABELS[ageCategory]}.`,
      });
      return;
    }


    const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
    const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

    if (isActualTeamMode) {
      setSubmitting(true);
      try {
        const team = await createTeamMutation.mutateAsync({
          competition_id: competition.id,
          name: finalTeamName,
          house_id: selectedHouse || null,
          seed_number: nextSeed,
          participant_name: finalParticipantName,
          user_id: null,
          age: ageValue,
          age_group: ageGroup,
          gender: gender || null,
          is_individual: false,
          logo_url: teamFlag && teamFlag !== "none" ? teamFlag : undefined,
        });

        if (team) {
          const memberInserts = members.map((m, index) => {
            const prof = profiles?.find((p) => p.id === m.profileId);
            const baseName = m.source === "user" ? (prof?.full_name || "") : m.name;
            return {
              team_id: team.id,
              user_id: m.source === "user" && m.profileId ? m.profileId : null,
              name: serializeMemberName(baseName, m.avatarUrl),
              is_captain: index === 0,
              house_block: m.source === "manual" && m.houseBlock.trim() ? m.houseBlock.trim() : null,
              house_number: m.source === "manual" && m.houseNumber.trim() ? m.houseNumber.trim() : null,
            };
          });

          const { error: membersError } = await supabase
            .from("competition_team_members")
            .insert(memberInserts);

          if (membersError) {
            console.error("Error adding team members:", membersError);
            toast({
              variant: "destructive",
              title: "Peringatan",
              description: "Tim berhasil dibuat, tetapi gagal menambahkan anggota.",
            });
          }
        }

        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal menambahkan tim ke kompetisi.",
        });
      } finally {
        setSubmitting(false);
      }
    } else if (isTeam) {
      // Individual registration in a team competition
      setSubmitting(true);
      try {
        const team = await createTeamMutation.mutateAsync({
          competition_id: competition.id,
          name: finalName,
          house_id: null, // house is hidden for >1v1
          seed_number: nextSeed,
          participant_name: finalName,
          user_id: source === "user" ? selectedProfileId : null,
          age: ageValue,
          age_group: ageGroup,
          gender: gender || null,
          is_individual: true,
          logo_url: singleAvatarUrl || (teamFlag && teamFlag !== "none" ? teamFlag : undefined),
        });

        if (team) {
          const memberInsert = {
            team_id: team.id,
            user_id: source === "user" ? selectedProfileId : null,
            name: serializeMemberName(finalName, singleAvatarUrl),
            is_captain: true,
          };

          const { error: memberError } = await supabase
            .from("competition_team_members")
            .insert(memberInsert);

          if (memberError) {
            console.error("Error adding team member:", memberError);
            toast({
              variant: "destructive",
              title: "Peringatan",
              description: "Peserta terdaftar, tetapi detail anggota gagal disimpan.",
            });
          }
        }
        onOpenChange(false);
      } catch (err) {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal mendaftarkan peserta.",
        });
      } finally {
        setSubmitting(false);
      }
    } else {
      // 1v1 Individual registration
      createTeamMutation.mutate(
        {
          competition_id: competition.id,
          name: finalName,
          house_id: selectedHouse || null,
          seed_number: nextSeed,
          participant_name: finalName,
          user_id: source === "user" ? selectedProfileId : null,
          age: ageValue,
          age_group: ageGroup,
          gender: gender || null,
          is_individual: false,
          logo_url: singleAvatarUrl || (teamFlag && teamFlag !== "none" ? teamFlag : undefined),
        },
        {
          onSuccess: () => onOpenChange(false),
        }
      );
    }
  };

  const isPending = createTeamMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pendaftaran Peserta</DialogTitle>
          <DialogDescription>
            Kategori: <span className="font-medium">{AGE_CATEGORY_LABELS[ageCategory]}</span>
            {" · "}
            <span className="font-medium">{GENDER_CATEGORY_LABELS[genderCategory]}</span>
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
          {isTeam && (
            <div className="space-y-2 pb-2 border-b">
              <Label>Cara Mendaftar</Label>
              <RadioGroup
                value={regMode}
                onValueChange={(v) => setRegMode(v as "team" | "individual")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="reg-team" value="team" />
                  <Label htmlFor="reg-team" className="font-normal cursor-pointer">
                    Daftar Sebagai Tim ({teamSize} Orang)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="reg-individual" value="individual" />
                  <Label htmlFor="reg-individual" className="font-normal cursor-pointer">
                    Daftar Individu (Satu per Satu)
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {!isActualTeamMode && (
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
          )}

          {isActualTeamMode && (
            <div className="space-y-2">
              <Label htmlFor="team-name">Nama Tim (Opsional)</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Nama tim (kosongkan untuk gabungan nama)"
              />
            </div>
          )}

          {isActualTeamMode ? (
            <div className="space-y-4">
              {members.map((member, i) => (
                <div key={i} className="space-y-2 border-l-2 border-primary/20 pl-3 py-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Anggota {i + 1} {i === 0 && "(Kapten)"} <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                      value={member.source}
                      onValueChange={(v) => {
                        const updated = [...members];
                        updated[i] = { ...updated[i], source: v as "user" | "manual", profileId: "", name: "" };
                        setMembers(updated);
                      }}
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem id={`src-user-${i}`} value="user" className="h-3 w-3" />
                        <Label htmlFor={`src-user-${i}`} className="text-xs font-normal cursor-pointer">
                          Warga
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem id={`src-manual-${i}`} value="manual" className="h-3 w-3" />
                        <Label htmlFor={`src-manual-${i}`} className="text-xs font-normal cursor-pointer">
                          Manual
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  {member.source === "user" ? (
                    <Select
                      value={member.profileId}
                      onValueChange={(v) => {
                        const updated = [...members];
                        updated[i] = { ...updated[i], profileId: v };
                        setMembers(updated);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Pilih warga untuk anggota ${i + 1}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {(profiles || []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || "(tanpa nama)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={member.name}
                        onChange={(e) => {
                          const updated = [...members];
                          updated[i] = { ...updated[i], name: e.target.value };
                          setMembers(updated);
                        }}
                        placeholder={`Nama anggota ${i + 1}`}
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Blok <span className="text-destructive">*</span></Label>
                          <Input
                            value={member.houseBlock}
                            onChange={(e) => {
                              const updated = [...members];
                              updated[i] = { ...updated[i], houseBlock: e.target.value };
                              setMembers(updated);
                            }}
                            placeholder="A"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">No. Rumah <span className="text-destructive">*</span></Label>
                          <Input
                            value={member.houseNumber}
                            onChange={(e) => {
                              const updated = [...members];
                              updated[i] = { ...updated[i], houseNumber: e.target.value };
                              setMembers(updated);
                            }}
                            placeholder="12"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <MemberAvatarSelector
                    avatarUrl={member.avatarUrl}
                    onChange={(url) => {
                      const updated = [...members];
                      updated[i] = { ...updated[i], avatarUrl: url };
                      setMembers(updated);
                    }}
                    defaultFallbackName={
                      member.source === "user"
                        ? profiles?.find((p) => p.id === member.profileId)?.full_name || `Anggota ${i + 1}`
                        : member.name || `Anggota ${i + 1}`
                    }
                    isRegisteredUser={member.source === "user" && !!member.profileId}
                    userProfileAvatar={
                      member.source === "user"
                        ? profiles?.find((p) => p.id === member.profileId)?.avatar_url
                        : null
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
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
              <MemberAvatarSelector
                avatarUrl={singleAvatarUrl}
                onChange={setSingleAvatarUrl}
                defaultFallbackName={
                  source === "user"
                    ? profiles?.find((p) => p.id === selectedProfileId)?.full_name || "Peserta"
                    : manualName || "Peserta"
                }
                isRegisteredUser={source === "user" && !!selectedProfileId}
                userProfileAvatar={
                  source === "user"
                    ? profiles?.find((p) => p.id === selectedProfileId)?.avatar_url
                    : null
                }
              />
            </>
          )}

          {!isTeam && !isActualTeamMode && !is17an && (
            <div className="space-y-2">
              <Label>
                Nomor Rumah
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
          )}

          {!isActualTeamMode && requireAge && (
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
                {hasBrackets && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground">Grup umur:</span>
                    {(customBrackets || []).map((b, i) => (
                      <Badge
                        key={i}
                        variant={
                          matchedBracket && formatBracket(matchedBracket) === formatBracket(b)
                            ? "default"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {formatBracket(b)}
                      </Badge>
                    ))}
                  </div>
                )}
                {ageGroup && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary">
                      Kategori: {AGE_GROUP_LABELS[ageGroup]}
                    </Badge>
                    {!hasBrackets && kidsBracket && (
                      <Badge variant="outline">Grup Anak: {kidsBracket}</Badge>
                    )}
                  </div>
                )}
                {bracketMismatch && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Umur {ageInput} tidak masuk grup umur yang tersedia.
                    </AlertDescription>
                  </Alert>
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
          )}


          {!isActualTeamMode && genderCategory === "mixed" && (
              <div className="space-y-2">
                <Label>
                  Jenis Kelamin
                </Label>
                <RadioGroup
                  value={gender}
                  onValueChange={(v) => setGender(v as Gender)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="g-male" value="male" />
                    <Label htmlFor="g-male" className="font-normal cursor-pointer">
                      {GENDER_LABELS.male}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="g-female" value="female" />
                    <Label htmlFor="g-female" className="font-normal cursor-pointer">
                      {GENDER_LABELS.female}
                    </Label>
                  </div>
                </RadioGroup>
                {genderMismatch && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Kompetisi ini khusus {GENDER_CATEGORY_LABELS[genderCategory]}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="team-flag">Bendera / Ikon Tim (Opsional)</Label>
            <Popover open={isFlagPopoverOpen} onOpenChange={setIsFlagPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  id="team-flag"
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal bg-background"
                >
                  {teamFlag ? (
                    <span className="flex items-center gap-2">
                      {getFlagImgUrl(teamFlag) ? (
                        <img src={getFlagImgUrl(teamFlag)!} alt="" className="w-5 h-3.5 object-cover rounded shadow-sm border shrink-0" />
                      ) : (
                        <span className="text-base">{teamFlag}</span>
                      )}
                      <span>{COUNTRIES.find(c => c.flag === teamFlag)?.name}</span>
                    </span>
                  ) : (
                    "Tanpa Bendera"
                  )}
                  <span className="text-muted-foreground ml-2 text-xs">▼</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] h-[240px] max-h-[50vh] overflow-hidden flex flex-col" align="start">
                <div className="p-2 shrink-0 bg-popover border-b border-border z-10">
                  <Input
                    placeholder="Cari bendera..."
                    value={flagSearch}
                    onChange={(e) => setFlagSearch(e.target.value)}
                    className="h-8 focus-visible:ring-emerald-500"
                  />
                </div>
                <div className="overflow-y-auto overscroll-contain touch-pan-y p-1 flex-1 min-h-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTeamFlag("");
                      setIsFlagPopoverOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors",
                      !teamFlag && "bg-accent/50 font-semibold text-primary"
                    )}
                  >
                    Tanpa Bendera
                  </button>
                  {filteredCountries.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setTeamFlag(c.flag);
                        setIsFlagPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2.5",
                        teamFlag === c.flag && "bg-accent/50 font-semibold text-primary"
                      )}
                    >
                      {getFlagImgUrl(c.flag) ? (
                        <img src={getFlagImgUrl(c.flag)!} alt="" className="w-5 h-3.5 object-cover rounded shadow-sm border shrink-0 select-none" />
                      ) : (
                        <span className="text-base select-none shrink-0">{c.flag}</span>
                      )}
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
              submitting ||
              isFormInvalid ||
              (!isTeam && isPaidEvent && !selectedHouse) ||
              (ageCategory === "kids" && ageInput.trim() !== "" && (ageValue == null || isNaN(ageValue))) ||
              !!categoryMismatch ||
              (!isActualTeamMode && genderCategory === "mixed" && genderMismatch)
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
