import { useState, useEffect, useMemo, useRef } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Loader2, AlertCircle, Wallet, Plus, Check, ChevronsUpDown, Trash2, Copy, Camera, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { MemberAvatarSelector, convertToWebP } from "./MemberAvatarSelector";
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
import { COUNTRIES, getFlagImgUrl, extractFlagAndName } from "@/lib/countries";
import type { Profile, House, Event } from "@/types/database";

export type ProfileWithHouse = { 
  id: string; 
  user_id: string | null;
  full_name: string; 
  avatar_url?: string | null;
  house_id?: string;
  house?: { block: string; number: string }; 
};

function ProfileCombobox({ 
  value, 
  onChange, 
  profiles, 
  placeholder,
  disabledProfileIds = []
}: { 
  value: string; 
  onChange: (val: string) => void; 
  profiles: ProfileWithHouse[]; 
  placeholder: string;
  disabledProfileIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { naturalSort } = useNaturalSort();

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return profiles.filter(p => {
      const searchableText = `${p.full_name || ""} ${p.house?.block || ""}${p.house?.number || ""} ${p.house?.block || ""} ${p.house?.number || ""}`.toLowerCase();
      return terms.every(term => searchableText.includes(term));
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
        <Command shouldFilter={false}>
          <CommandInput placeholder="Cari warga..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Warga tidak ditemukan.</CommandEmpty>
            {groupedProfiles.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map((p) => {
                  const isDisabled = disabledProfileIds?.includes(p.id);
                  return (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      disabled={isDisabled}
                      onSelect={() => {
                        if (isDisabled) return;
                        onChange(p.id === value ? "" : p.id);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === p.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {p.full_name || "(tanpa nama)"}
                      {isDisabled && <span className="ml-auto text-[10px] text-muted-foreground border px-1 rounded bg-muted/30">Sudah Masuk</span>}
                    </CommandItem>
                  );
                })}
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
      case "4v4": return 4;
      case "5v5": return 5;
      case "11v11": return 11;
      default: return 1;
    }
  }, [competition?.match_type]);

  const [regMode, setRegMode] = useState<"team" | "individual">("team");
  const isActualTeamMode = regMode === "team";

  const [members, setMembers] = useState<{ source: "user" | "manual"; profileId: string; name: string; avatarUrl: string; houseBlock: string; houseNumber: string }[]>(
    () => Array.from({ length: teamSize }, () => ({ source: "user", profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" }))
  );
  const [singleAvatarUrl, setSingleAvatarUrl] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamFlag, setTeamFlag] = useState("");
  const [flagSearch, setFlagSearch] = useState("");
  const [isFlagPopoverOpen, setIsFlagPopoverOpen] = useState(false);
  const [isHousePopoverOpen, setIsHousePopoverOpen] = useState(false);
  const [isUploadingTeamPhoto, setIsUploadingTeamPhoto] = useState(false);
  const teamFileInputRef = useRef<HTMLInputElement>(null);
  const teamCameraInputRef = useRef<HTMLInputElement>(null);

  const filteredCountries = useMemo(() => {
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(flagSearch.toLowerCase())
    );
  }, [flagSearch]);

  const handleTeamPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "File tidak valid",
        description: "Silakan pilih file gambar (JPG, PNG, dll)",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File terlalu besar",
        description: "Ukuran maksimal foto adalah 5MB",
      });
      return;
    }

    setIsUploadingTeamPhoto(true);
    try {
      let processedFile = file;
      if (file.type !== "image/webp") {
        try {
          processedFile = await convertToWebP(file);
        } catch (convertErr) {
          console.warn("Failed to convert to WebP", convertErr);
        }
      }

      const fileExt = processedFile.type === "image/webp" ? "webp" : processedFile.name.split(".").pop() || "jpg";
      const randomId = Math.random().toString(36).substring(2, 15);
      const filePath = `teams/${randomId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("competition-avatars")
        .upload(filePath, processedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("competition-avatars")
        .getPublicUrl(filePath);

      setTeamFlag(urlData.publicUrl);
      toast({ title: "Foto tim berhasil diunggah" });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal mengunggah foto",
        description: "Terjadi kesalahan saat mengunggah foto tim",
      });
    } finally {
      setIsUploadingTeamPhoto(false);
    }
  };
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

  const { data: otherTeams } = useQuery({
    queryKey: ["other-teams", competition.event_id, competition.id],
    queryFn: async () => {
      let competitionsData: { id: string; sport_name: string }[] = [];
      
      if (competition.event_id) {
        const eventIdStr: string = competition.event_id;
        const { data } = await supabase
          .from("event_competitions")
          .select("id, sport_name")
          .eq("event_id", eventIdStr);
        if (data) competitionsData = data;
      }
      
      if (competitionsData.length === 0) {
        const { data } = await supabase
          .from("event_competitions")
          .select("id, sport_name")
          .order("created_at", { ascending: false })
          .limit(20);
        if (data) competitionsData = data;
      }
      
      const compIds = competitionsData.map(c => c.id);
      if (compIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("competition_teams")
        .select(`
          *,
          members:competition_team_members (*)
        `)
        .in("competition_id", compIds)
        .order("created_at", { ascending: false });
        
      if (error || !data) return [];
      
      const typedData = data as unknown as import("@/types/competition").CompetitionTeamWithMembers[];
      
      return typedData.map(team => {
        const comp = competitionsData.find(c => c.id === team.competition_id);
        return {
          ...team,
          sport_name: comp?.sport_name || "Lomba Lain"
        };
      });
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

  const disabledProfileIds = useMemo(() => {
    const alreadyAddedIds = new Set<string>();
    const alreadyAddedNames = new Set<string>();

    if (competition?.teams) {
      competition.teams.forEach(t => {
        if (t.user_id) alreadyAddedIds.add(t.user_id);
        if (t.participant_name) {
          const parsed = parseMemberName(t.participant_name);
          alreadyAddedNames.add(parsed.name.toLowerCase().trim());
        }
        
        t.members?.forEach(m => {
          if (m.user_id) alreadyAddedIds.add(m.user_id);
          if (m.name) {
            const parsed = parseMemberName(m.name);
            alreadyAddedNames.add(parsed.name.toLowerCase().trim());
          }
        });
      });
    }

    // Also disable those currently selected in the form
    members.forEach(m => {
      if (m.source === "user" && m.profileId) {
        alreadyAddedIds.add(m.profileId);
      }
    });
    
    if (!isActualTeamMode && source === "user" && selectedProfileId) {
      alreadyAddedIds.add(selectedProfileId);
    }

    return (profiles || []).filter(p => {
      if (alreadyAddedIds.has(p.id)) return true;
      if (p.user_id && alreadyAddedIds.has(p.user_id)) return true;
      if (p.full_name && alreadyAddedNames.has(p.full_name.toLowerCase().trim())) return true;
      return false;
    }).map(p => p.id);
  }, [competition.teams, profiles, members, isActualTeamMode, source, selectedProfileId]);


  useEffect(() => {
    if (open) {
      setRegMode(teamSize > 1 ? "team" : "individual");
      setMembers(Array.from({ length: Math.max(1, teamSize) }, () => ({ source: "user" as const, profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" })));
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
  }, [open, teamSize]);

  const handleAddMember = () => {
    setMembers([...members, { source: "user", profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" }]);
  };

  const handleRemoveMember = (index: number) => {
    if (members.length > 1) {
      setMembers(members.filter((_, i) => i !== index));
    }
  };

  const [isCopyPopoverOpen, setIsCopyPopoverOpen] = useState(false);
  const [copySearch, setCopySearch] = useState("");

  const filteredOtherTeams = useMemo(() => {
    if (!otherTeams) return [];
    if (!copySearch) return otherTeams;
    const lower = copySearch.toLowerCase();
    return otherTeams.filter(t => 
      (t.name || "").toLowerCase().includes(lower) || 
      (t.participant_name || "").toLowerCase().includes(lower)
    );
  }, [otherTeams, copySearch]);

  const groupedOtherTeams = useMemo(() => {
    const groups: Record<string, typeof otherTeams> = {};
    filteredOtherTeams.forEach(t => {
      if (!groups[t.sport_name]) groups[t.sport_name] = [];
      groups[t.sport_name].push(t);
    });
    return groups;
  }, [filteredOtherTeams]);

  const handleCopyTeam = (copiedTeam: import("@/types/competition").CompetitionTeamWithMembers & { sport_name: string }) => {
    setRegMode(copiedTeam.is_individual ? "individual" : "team");
    setTeamName(copiedTeam.name || "");
    setTeamFlag(copiedTeam.logo_url || "");
    setAgeInput(copiedTeam.age ? String(copiedTeam.age) : "");
    setGender((copiedTeam.gender as import("@/lib/age-groups").Gender) || "");
    
    if (copiedTeam.is_individual) {
      const firstMember = copiedTeam.members?.[0];
      if (copiedTeam.user_id) {
        setSource("user");
        setSelectedProfileId(copiedTeam.user_id);
        setSingleAvatarUrl(copiedTeam.logo_url || parseMemberName(firstMember?.name).avatarUrl);
      } else {
        setSource("manual");
        setManualName(copiedTeam.participant_name || copiedTeam.name || parseMemberName(firstMember?.name).name);
        setSelectedHouse(copiedTeam.house_id || "");
        setSingleAvatarUrl(copiedTeam.logo_url || parseMemberName(firstMember?.name).avatarUrl);
      }
    } else {
      const sortedMembers = [...(copiedTeam.members || [])].sort((a, b) => {
        if (a.is_captain) return -1;
        if (b.is_captain) return 1;
        return a.created_at.localeCompare(b.created_at);
      });
      
      const newMembers = sortedMembers.map(m => {
        const parsed = parseMemberName(m.name);
        return {
          source: (m.user_id ? "user" : "manual") as "user" | "manual",
          profileId: m.user_id || "",
          name: parsed.name,
          avatarUrl: parsed.avatarUrl,
          houseBlock: m.house_block || "",
          houseNumber: m.house_number || "",
        };
      });
      
      while(newMembers.length < teamSize) {
         newMembers.push({ source: "user", profileId: "", name: "", avatarUrl: "", houseBlock: "", houseNumber: "" });
      }
      
      setMembers(newMembers.slice(0, Math.max(teamSize, newMembers.length)));
    }
    setIsCopyPopoverOpen(false);
  };

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
    if (!isActualTeamMode && !is17an && isPaidEvent) {
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
    } else {
      // Individual registration
      setSubmitting(true);
      try {
        const team = await createTeamMutation.mutateAsync({
          competition_id: competition.id,
          name: finalName,
          house_id: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.house_id || null) : (selectedHouse || null),
          seed_number: nextSeed,
          participant_name: finalName,
          user_id: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.user_id || null) : null,
          age: ageValue,
          age_group: ageGroup,
          gender: gender || null,
          is_individual: true,
          logo_url: singleAvatarUrl || (teamFlag && teamFlag !== "none" ? teamFlag : undefined),
        });

        if (team) {
          const memberInsert = {
            team_id: team.id,
            user_id: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.user_id || null) : null,
            name: serializeMemberName(finalName, singleAvatarUrl || profiles?.find(p => p.id === selectedProfileId)?.avatar_url || ""),
            is_captain: true,
            house_block: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.house?.block || null) : null,
            house_number: source === "user" ? (profiles?.find(p => p.id === selectedProfileId)?.house?.number || null) : null,
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
            {!is17an && isPaidEvent && " · Rumah harus sudah membayar."}
          </DialogDescription>
        </DialogHeader>

        {!is17an && isPaidEvent && (

          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Acara Berbayar</AlertTitle>
            <AlertDescription>
              {paidHouseIds.size} rumah sudah membayar. Hanya rumah lunas dapat didaftarkan.
            </AlertDescription>
          </Alert>
        )}

        {!is17an && eligibleHouses.length === 0 && (
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
                    Daftar Sebagai Tim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="reg-individual" value="individual" />
                  <Label htmlFor="reg-individual" className="font-normal cursor-pointer">
                    Daftar Individu
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2 pb-2 border-b">
              <Label>Pilih Peserta/Tim (Salin dari Match / Lomba Lain)</Label>
              <Popover open={isCopyPopoverOpen} onOpenChange={setIsCopyPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                    <Copy className="mr-2 h-4 w-4" />
                    Salin dari Match / Lomba Lain...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-80 overflow-y-auto" align="start">
                  <Command>
                    <CommandInput placeholder="Cari nama peserta/tim..." value={copySearch} onValueChange={setCopySearch} />
                    <CommandList>
                      <CommandEmpty>Belum ada data peserta dari match/lomba lain.</CommandEmpty>
                      {Object.entries(groupedOtherTeams).map(([sportName, teams]) => (
                        <CommandGroup key={sportName} heading={sportName}>
                          {teams.map(t => (
                            <CommandItem
                              key={t.id}
                              value={`${t.name} ${t.participant_name}`}
                              onSelect={() => handleCopyTeam(t)}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span>{t.is_individual ? t.participant_name : t.name}</span>
                                {!t.is_individual && t.participant_name && t.participant_name !== t.name && (
                                  <span className="text-xs text-muted-foreground">{t.participant_name}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

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
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="team-name">Nama Tim (Opsional)</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Nama tim (kosongkan untuk gabungan nama)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">Foto / Logo Tim (Opsional)</Label>
                <MemberAvatarSelector
                  avatarUrl={teamFlag}
                  onChange={(url) => setTeamFlag(url)}
                  defaultFallbackName={teamName || "Tim"}
                />
              </div>
            </div>
          )}

          {isActualTeamMode ? (
            <div className="space-y-4">
              {members.map((member, i) => (
                <div key={i} className="space-y-2 border-l-2 border-primary/20 pl-3 py-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground">
                        Anggota {i + 1} {i === 0 && "(Kapten)"} <span className="text-destructive">*</span>
                      </Label>
                      {members.length > 1 && (
                        <button
                          type="button"
                          className="text-destructive hover:text-destructive/80 shrink-0 ml-2"
                          onClick={() => handleRemoveMember(i)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
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
                    <ProfileCombobox
                      value={member.profileId}
                      onChange={(v) => {
                        const updated = [...members];
                        updated[i] = { ...updated[i], profileId: v };
                        setMembers(updated);
                      }}
                      profiles={profiles || []}
                      placeholder={`Pilih warga untuk anggota ${i + 1}`}
                      disabledProfileIds={disabledProfileIds}
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
                                  {eligibleHouses.map((h) => (
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={handleAddMember}
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Anggota
              </Button>
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
                    disabledProfileIds={disabledProfileIds}
                  />
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

          {!isActualTeamMode && source === "manual" && (
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
                          const h = eligibleHouses.find((h) => h.id === selectedHouse);
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
                        {eligibleHouses.map((h) => (
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


          {!isActualTeamMode && !is17an && genderCategory === "mixed" && (
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
              (!isActualTeamMode && !is17an && isPaidEvent && !selectedHouse) ||
              (!isActualTeamMode && requireAge && (ageValue == null || isNaN(ageValue))) ||
              (!isActualTeamMode && bracketMismatch) ||
              !!categoryMismatch ||
              (!isActualTeamMode && !is17an && genderCategory === "mixed" && genderMismatch)
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
