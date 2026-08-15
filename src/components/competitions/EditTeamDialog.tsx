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
import { Loader2, AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
import { COUNTRIES, getFlagImgUrl } from "@/lib/countries";
import type { Profile, House } from "@/types/database";
import { useNaturalSort } from "@/hooks/useNaturalSort";

export type ProfileWithHouse = { 
  id: string; 
  user_id: string | null;
  full_name: string; 
  avatar_url?: string | null;
  house_id?: string;
  house?: { block: string; number: string }; 
};

import { MemberAvatarSelector } from "./MemberAvatarSelector";

function ProfileCombobox({ 
  value, 
  onChange, 
  profiles, 
  placeholder 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  profiles: ProfileWithHouse[]; 
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { naturalSort } = useNaturalSort();

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const lower = search.toLowerCase();
    return profiles.filter(p => {
      const nameMatch = (p.full_name || "").toLowerCase().includes(lower);
      const blockMatch = p.house?.block?.toLowerCase().includes(lower);
      const numberMatch = p.house?.number?.toLowerCase().includes(lower);
      const fullHouseMatch = p.house ? `${p.house.block}${p.house.number}`.toLowerCase().includes(lower) : false;
      const fullHouseMatchWithSpace = p.house ? `${p.house.block} ${p.house.number}`.toLowerCase().includes(lower) : false;
      return nameMatch || blockMatch || numberMatch || fullHouseMatch || fullHouseMatchWithSpace;
    });
  }, [profiles, search]);

  const groupedProfiles = useMemo(() => {
    const groups: Record<string, ProfileWithHouse[]> = {};
    const noHouse: ProfileWithHouse[] = [];

    filtered.forEach(p => {
      if (p.house) {
        const key = `${p.house.block}${p.house.number}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      } else {
        noHouse.push(p);
      }
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => naturalSort(a, b));

    const result: { group: string; items: ProfileWithHouse[] }[] = [];
    sortedKeys.forEach(k => {
      groups[k].sort((a, b) => naturalSort(a.full_name || "", b.full_name || ""));
      result.push({ group: k, items: groups[k] });
    });
    if (noHouse.length > 0) {
      noHouse.sort((a, b) => naturalSort(a.full_name || "", b.full_name || ""));
      result.push({ group: "Tanpa Rumah", items: noHouse });
    }
    return result;
  }, [filtered, naturalSort]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal bg-background"
        >
          {value
            ? (() => {
                const p = profiles.find((x) => x.id === value);
                if (!p) return placeholder;
                const name = p.full_name || "(tanpa nama)";
                return p.house ? `${name} (${p.house.block}${p.house.number})` : name;
              })()
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-h-80 overflow-y-auto" align="start">
        <Command>
          <CommandInput placeholder="Cari warga..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Warga tidak ditemukan.</CommandEmpty>
            {groupedProfiles.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.id === value ? "" : p.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === p.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {p.full_name || "(tanpa nama)"}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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

const deleteAvatarFromStorage = async (url: string) => {
  if (!url || !url.includes("competition-avatars")) return;
  try {
    const match = url.match(/\/competition-avatars\/([^?]+)/);
    if (match && match[1]) {
      const filePath = match[1];
      await supabase.storage.from("competition-avatars").remove([filePath]);
    }
  } catch (err) {
    console.error("Failed to delete avatar from storage:", err);
  }
};

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
  const [isHousePopoverOpen, setIsHousePopoverOpen] = useState(false);

  const [teamFlag, setTeamFlag] = useState("");
  const [flagSearch, setFlagSearch] = useState("");
  const [isFlagPopoverOpen, setIsFlagPopoverOpen] = useState(false);
  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(flagSearch.toLowerCase())
    );
  }, [flagSearch]);

  // Roster members (for full team mode)
  const [members, setMembers] = useState<{ source: "user" | "manual"; profileId: string; name: string; avatarUrl: string; houseBlock: string; houseNumber: string }[]>([]);
  const [singleAvatarUrl, setSingleAvatarUrl] = useState("");
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

  const sortedHouses = useMemo(() => {
    if (!houses) return [];
    return [...houses].sort((a, b) => {
      if (a.block === b.block) {
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      }
      return a.block.localeCompare(b.block);
    });
  }, [houses]);

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data: membersData, error: membersError } = await supabase
        .from("house_members")
        .select(`
          id,
          user_id,
          house_id,
          full_name,
          house:houses ( block, number )
        `)
        .eq("status", "approved")
        .order("full_name", { ascending: true });
        
      if (membersError) throw membersError;

      const userIds = (membersData || [])
        .map(m => m.user_id)
        .filter(Boolean) as string[];

      const profilesMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .in("id", userIds);
          
        if (profilesData) {
          profilesData.forEach(p => {
            if (p.avatar_url) profilesMap.set(p.id, p.avatar_url);
          });
        }
      }
      
      const typedData = membersData as unknown as { 
        id: string; 
        user_id: string | null;
        house_id: string | null;
        full_name: string;
        house: { block: string; number: string } | null;
      }[];
      
      return (typedData || []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        house_id: m.house_id || undefined,
        full_name: m.full_name,
        avatar_url: m.user_id ? profilesMap.get(m.user_id) : null,
        house: m.house || undefined
      })) as ProfileWithHouse[];
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

      const isFlag = team.logo_url && !team.logo_url.includes("/");
      setTeamFlag(isFlag ? team.logo_url : "");
      setFlagSearch("");

      const isActualIndividual = !isTeam || !!team.is_individual;

      if (isActualIndividual) {
        setSource(team.user_id ? "user" : "manual");
        setSelectedProfileId(team.user_id || "");
        const parsed = parseMemberName(team.participant_name || team.name);
        setManualName(parsed.name);
        setSingleAvatarUrl((team.logo_url && !isFlag) ? team.logo_url : (parsed.avatarUrl || ""));
      } else {
        // Map existing members
        const existingMembers = (team.members || []).map(m => {
          const parsed = parseMemberName(m.name);
          return {
            source: (m.user_id ? "user" : "manual") as "user" | "manual",
            profileId: m.user_id || "",
            name: parsed.name,
            avatarUrl: parsed.avatarUrl || "",
            houseBlock: (m as unknown as { house_block?: string | null }).house_block || "",
            houseNumber: (m as unknown as { house_number?: string | null }).house_number || "",
          };
        });

        // Pad to match team size if needed
        while (existingMembers.length < teamSize) {
          existingMembers.push({ source: "user", profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" });
        }
        setMembers(existingMembers);
      }
    } else {
      setFlagSearch("");
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
      // Track old avatars to clean up
      const oldAvatars = (team.members || []).map(m => parseMemberName(m.name).avatarUrl).filter(Boolean);
      if (team.logo_url) {
        oldAvatars.push(team.logo_url);
      }

      // Track new avatars that should be kept
      const newAvatars: string[] = [];
      if (!isTeam || isIndividual) {
        if (singleAvatarUrl) newAvatars.push(singleAvatarUrl);
      } else {
        members.forEach(m => {
          if (m.avatarUrl) newAvatars.push(m.avatarUrl);
        });
      }

      if (!isTeam || isIndividual) {
        // Update individual team
        const { error: teamError } = await supabase
          .from("competition_teams")
          .update({
            name: finalTeamName,
            participant_name: finalParticipantName,
            user_id: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.user_id || null) : null,
            house_id: !isTeam ? (source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.house_id || null) : (selectedHouse || null)) : null,
            age: ageValue,
            age_group: ageGroup,
            gender: gender || null,
            logo_url: singleAvatarUrl || (teamFlag && teamFlag !== "none" ? teamFlag : null),
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
              user_id: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.user_id || null) : null,
              name: serializeMemberName(finalName, singleAvatarUrl),
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
            logo_url: teamFlag && teamFlag !== "none" ? teamFlag : null,
          })
          .eq("id", team.id);

        if (teamError) throw teamError;

        // Re-create team members
        await supabase.from("competition_team_members").delete().eq("team_id", team.id);

        const memberInserts = members.map((m, index) => {
          const prof = profiles?.find((p) => p.id === m.profileId);
          const baseName = m.source === "user" ? (prof?.full_name || "") : m.name;
          return {
            team_id: team.id,
            user_id: m.source === "user" ? (prof?.user_id || null) : null,
            name: serializeMemberName(baseName, m.avatarUrl || prof?.avatar_url || ""),
            is_captain: index === 0,
            house_block: m.source === "user" ? (prof?.house?.block || null) : (m.source === "manual" && m.houseBlock.trim() ? m.houseBlock.trim() : null),
            house_number: m.source === "user" ? (prof?.house?.number || null) : (m.source === "manual" && m.houseNumber.trim() ? m.houseNumber.trim() : null),
          };
        });

        const { error: membersError } = await supabase
          .from("competition_team_members")
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      // Safe clean up of unused avatars
      const unused = oldAvatars.filter(url => url && !newAvatars.includes(url));
      for (const url of unused) {
        await deleteAvatarFromStorage(url);
      }

      queryClient.invalidateQueries({
        queryKey: ["competition-details", competition.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["live-teams"],
      });
      queryClient.invalidateQueries({
        queryKey: ["live-matches"],
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
                        updated[i] = { ...updated[i], source: v as "user" | "manual", profileId: "", name: "", avatarUrl: "" };
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
                    <ProfileCombobox
                      value={member.profileId}
                      onChange={(v) => {
                        const updated = [...members];
                        updated[i] = { ...updated[i], profileId: v };
                        setMembers(updated);
                      }}
                      profiles={profiles || []}
                      placeholder={`Pilih warga untuk anggota ${i + 1}`}
                    />
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
                      <div className="space-y-1 mt-2">
                        <Label className="text-xs text-muted-foreground">Pilih Rumah <span className="text-destructive">*</span></Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal bg-background h-9"
                            >
                              {member.houseBlock && member.houseNumber
                                ? `${member.houseBlock}${member.houseNumber}`
                                : "Pilih rumah..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto" align="start">
                            <Command>
                              <CommandInput placeholder="Cari..." />
                              <CommandList>
                                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                  {sortedHouses.map((h) => (
                                    <CommandItem
                                      key={h.id}
                                      value={`${h.block}${h.number}`}
                                      onSelect={() => {
                                        const updated = [...members];
                                        updated[i] = { ...updated[i], houseBlock: h.block, houseNumber: h.number };
                                        setMembers(updated);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          member.houseBlock === h.block && member.houseNumber === h.number ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {h.block}{h.number}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                  <ProfileCombobox
                    value={selectedProfileId}
                    onChange={setSelectedProfileId}
                    profiles={profiles || []}
                    placeholder="Pilih warga"
                  />
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

          {!isTeam && source === "manual" && (
            <div className="space-y-2">
              <Label>Nomor Rumah <span className="text-destructive">*</span></Label>
              <Popover open={isHousePopoverOpen} onOpenChange={setIsHousePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isHousePopoverOpen}
                    className="w-full justify-between font-normal bg-background"
                  >
                    {selectedHouse
                      ? (() => {
                          const h = houses?.find((h) => h.id === selectedHouse);
                          return h ? `${h.block}${h.number}` : "Pilih rumah";
                        })()
                      : "Pilih rumah..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-h-60 overflow-y-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Cari..." />
                    <CommandList>
                      <CommandEmpty>Rumah tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {sortedHouses.map((h) => (
                          <CommandItem
                            key={h.id}
                            value={`${h.block}${h.number}`}
                            onSelect={() => {
                              setSelectedHouse(h.id === selectedHouse ? "" : h.id);
                              setIsHousePopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedHouse === h.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {h.block}{h.number}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          <div className="space-y-2">
            <Label htmlFor="edit-team-flag">Bendera / Ikon Tim (Opsional)</Label>
            <Popover open={isFlagPopoverOpen} onOpenChange={setIsFlagPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  id="edit-team-flag"
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
