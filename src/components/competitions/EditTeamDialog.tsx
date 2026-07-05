import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import type { Profile, House } from "@/types/database";

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: CompetitionTeamWithMembers | null;
  competition: EventCompetitionWithDetails;
}

export function EditTeamDialog({ open, onOpenChange, team, competition }: EditTeamDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Form states
  const [teamName, setTeamName] = useState("");
  const [isIndividual, setIsIndividual] = useState(false);
  const [source, setSource] = useState<"user" | "manual">("user");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [manualName, setManualName] = useState("");
  const [selectedHouse, setSelectedHouse] = useState("");
  const [ageInput, setAgeInput] = useState("");
  const [gender, setGender] = useState<Gender | "">("");

  // Roster members (for full team mode)
  const [members, setMembers] = useState<{ source: "user" | "manual"; profileId: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const ageCategory = (competition.age_category as AgeCategory) || "mixed";
  const genderCategory = ((competition as unknown as { gender_category?: GenderCategory }).gender_category) || "mixed";

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

  useEffect(() => {
    if (open && team) {
      setIsIndividual(!!team.is_individual);
      setTeamName(team.name || "");
      setSelectedHouse(team.house_id || "");
      setAgeInput(team.age != null ? String(team.age) : "");
      setGender((team.gender as Gender) || "");

      const isActualIndividual = !isTeam || !!team.is_individual;

      if (isActualIndividual) {
        setSource(team.user_id ? "user" : "manual");
        setSelectedProfileId(team.user_id || "");
        setManualName(team.participant_name || "");
      } else {
        // Map existing members
        const existingMembers = (team.members || []).map(m => ({
          source: (m.user_id ? "user" : "manual") as "user" | "manual",
          profileId: m.user_id || "",
          name: m.name || "",
        }));

        // Pad to match team size if needed
        while (existingMembers.length < teamSize) {
          existingMembers.push({ source: "user", profileId: "", name: "" });
        }
        setMembers(existingMembers);
      }
    }
  }, [open, team, teamSize, isTeam]);

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

  const finalParticipantName = (!isTeam || isIndividual)
    ? finalName
    : memberNames.filter(Boolean).join(" & ");

  const finalTeamName = (!isTeam || isIndividual)
    ? finalParticipantName
    : (teamName.trim() || finalParticipantName);

  const isFormInvalid = (!isTeam || isIndividual)
    ? !finalName
    : memberNames.some((name) => !name);

  const handleSubmit = async () => {
    if (!team) return;

    if (!isTeam || isIndividual) {
      if (!finalName) {
        toast({ variant: "destructive", title: "Nama peserta wajib diisi" });
        return;
      }
      if (!isTeam && genderCategory !== "mixed" && !gender) {
        toast({ variant: "destructive", title: "Jenis kelamin wajib dipilih" });
        return;
      }
      if (!isTeam && genderMismatch) {
        toast({ variant: "destructive", title: "Jenis kelamin tidak sesuai" });
        return;
      }
    } else {
      const hasEmptyMember = memberNames.some((name) => !name);
      if (hasEmptyMember) {
        toast({
          variant: "destructive",
          title: "Nama anggota wajib diisi",
          description: `Harap lengkapi semua ${teamSize} nama anggota tim.`,
        });
        return;
      }
    }

    if (ageValue != null && (isNaN(ageValue) || ageValue < 0)) {
      toast({
        variant: "destructive",
        title: "Umur tidak valid",
        description: "Masukkan umur yang valid.",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (!isTeam || isIndividual) {
        // Update individual team
        const { error: teamError } = await supabase
          .from("competition_teams")
          .update({
            name: finalTeamName,
            participant_name: finalParticipantName,
            user_id: source === "user" ? selectedProfileId : null,
            house_id: !isTeam ? (selectedHouse || null) : null,
            age: ageValue,
            age_group: ageGroup,
            gender: gender || null,
          })
          .eq("id", team.id);

        if (teamError) throw teamError;

        if (isTeam && isIndividual) {
          // Sync team members for team format (single member row)
          await supabase.from("competition_team_members").delete().eq("team_id", team.id);
          const { error: memError } = await supabase
            .from("competition_team_members")
            .insert({
              team_id: team.id,
              user_id: source === "user" ? selectedProfileId : null,
              name: source === "manual" ? manualName.trim() : null,
              is_captain: true,
            });
          if (memError) console.error("Error updating member roster:", memError);
        }
      } else {
        // Update formed team
        const { error: teamError } = await supabase
          .from("competition_teams")
          .update({
            name: finalTeamName,
            participant_name: finalParticipantName,
            house_id: selectedHouse || null,
            age: ageValue,
            age_group: ageGroup,
            gender: gender || null,
          })
          .eq("id", team.id);

        if (teamError) throw teamError;

        // Re-create team members
        await supabase.from("competition_team_members").delete().eq("team_id", team.id);

        const memberInserts = members.map((m, index) => ({
          team_id: team.id,
          user_id: m.source === "user" && m.profileId ? m.profileId : null,
          name: m.source === "manual" ? m.name.trim() : null,
          is_captain: index === 0,
        }));

        const { error: membersError } = await supabase
          .from("competition_team_members")
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      queryClient.invalidateQueries({
        queryKey: ["competition-details", competition.id],
      });
      toast({ title: "Berhasil", description: "Peserta berhasil diperbarui" });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menyimpan perubahan peserta.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const showTeamFields = isTeam && !isIndividual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Detail Peserta</DialogTitle>
          <DialogDescription>
            Ubah detail pendaftaran dan roster anggota.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          {!showTeamFields && (
            <div className="space-y-2">
              <Label>Sumber Peserta</Label>
              <RadioGroup
                value={source}
                onValueChange={(v) => setSource(v as "user" | "manual")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="edit-src-user" value="user" />
                  <Label htmlFor="edit-src-user" className="font-normal cursor-pointer">
                    Warga Terdaftar
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="edit-src-manual" value="manual" />
                  <Label htmlFor="edit-src-manual" className="font-normal cursor-pointer">
                    Manual
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {showTeamFields && (
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Nama Tim</Label>
              <Input
                id="edit-team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Nama tim"
              />
            </div>
          )}

          {showTeamFields ? (
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
                        <RadioGroupItem id={`edit-src-user-${i}`} value="user" className="h-3 w-3" />
                        <Label htmlFor={`edit-src-user-${i}`} className="text-xs font-normal cursor-pointer">
                          Warga
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem id={`edit-src-manual-${i}`} value="manual" className="h-3 w-3" />
                        <Label htmlFor={`edit-src-manual-${i}`} className="text-xs font-normal cursor-pointer">
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
                    <Input
                      value={member.name}
                      onChange={(e) => {
                        const updated = [...members];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setMembers(updated);
                      }}
                      placeholder={`Nama anggota ${i + 1}`}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            source === "user" ? (
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
                <Label htmlFor="edit-manual-name">
                  Nama Peserta <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-manual-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nama peserta"
                />
              </div>
            )
          )}

          {!isTeam && (
            <div className="space-y-2">
              <Label>Nomor Rumah</Label>
              <Select value={selectedHouse} onValueChange={setSelectedHouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rumah" />
                </SelectTrigger>
                <SelectContent>
                  {(houses || []).map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      Blok {h.block} No. {h.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!showTeamFields && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-age">Umur (tahun)</Label>
                <Input
                  id="edit-age"
                  type="text"
                  inputMode="decimal"
                  value={ageInput}
                  onChange={(e) => setAgeInput(e.target.value)}
                  placeholder="contoh: 7, 25"
                />
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
                      Umur tidak masuk kategori {AGE_CATEGORY_LABELS[ageCategory]}.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label>Jenis Kelamin</Label>
                <RadioGroup
                  value={gender}
                  onValueChange={(v) => setGender(v as Gender)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="edit-g-male" value="male" />
                    <Label htmlFor="edit-g-male" className="font-normal cursor-pointer">
                      Laki-laki
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="edit-g-female" value="female" />
                    <Label htmlFor="edit-g-female" className="font-normal cursor-pointer">
                      Perempuan
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              isFormInvalid ||
              (ageInput.trim() !== "" && (ageValue == null || isNaN(ageValue))) ||
              !!categoryMismatch ||
              (!isTeam && genderCategory !== "mixed" && !gender) ||
              (!isTeam && genderMismatch)
            }
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
