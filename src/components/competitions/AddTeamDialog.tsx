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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Users, ListPlus, AlertCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateTeam, useAddTeamMember } from "@/hooks/useCompetitions";
import { useEventHousePayments } from "@/hooks/useEventHousePayments";
import { useToast } from "@/hooks/use-toast";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { getInitials } from "@/lib/utils";
import type { EventCompetitionWithDetails } from "@/types/competition";
import type { Profile, House, Event } from "@/types/database";

interface AddTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

export function AddTeamDialog({ open, onOpenChange, competition }: AddTeamDialogProps) {
  const [activeMode, setActiveMode] = useState<"single" | "batch">("single");
  const [teamName, setTeamName] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Batch: select multiple houses; one team per house, using house label as default name
  const [batchHouses, setBatchHouses] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState("");

  const { toast } = useToast();
  const { naturalSort } = useNaturalSort();
  const createTeamMutation = useCreateTeam();
  const addMemberMutation = useAddTeamMember();

  // Fetch parent event to know paid-event status
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

  // Fetch houses
  const { data: houses } = useQuery({
    queryKey: ["houses-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block", { ascending: true })
        .order("number", { ascending: true });
      if (error) throw error;
      return data as House[];
    },
    enabled: open,
  });

  // Fetch all profiles
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
  const paidHouseIds = useMemo(() => new Set((payments || []).map((p) => p.house_id)), [payments]);
  const registeredHouseIds = useMemo(
    () => new Set((competition.teams || []).map((t) => t.house_id).filter(Boolean) as string[]),
    [competition.teams]
  );

  const sortedHouses = useMemo(() => {
    if (!houses) return [];
    return [...houses].sort((a, b) =>
      naturalSort(`${a.block}-${a.number}`, `${b.block}-${b.number}`)
    );
  }, [houses, naturalSort]);

  // Houses that are eligible to register (paid if required, not already registered)
  const eligibleHouses = useMemo(() => {
    return sortedHouses.filter((h) => {
      if (registeredHouseIds.has(h.id)) return false;
      if (isPaidEvent && !paidHouseIds.has(h.id)) return false;
      return true;
    });
  }, [sortedHouses, registeredHouseIds, isPaidEvent, paidHouseIds]);

  useEffect(() => {
    if (!open) {
      setTeamName("");
      setSelectedHouse("");
      setSelectedMembers([]);
      setCaptainId("");
      setSearchQuery("");
      setActiveMode("single");
      setBatchHouses([]);
      setBatchSearch("");
    }
  }, [open]);

  const houseLabel = (id: string) => {
    const h = houses?.find((x) => x.id === id);
    return h ? `Blok ${h.block} No. ${h.number}` : "";
  };

  const handleSubmit = async () => {
    if (activeMode === "single") {
      if (!selectedHouse) {
        toast({
          variant: "destructive",
          title: "Nomor rumah wajib diisi",
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
      if (registeredHouseIds.has(selectedHouse)) {
        toast({
          variant: "destructive",
          title: "Rumah sudah terdaftar",
          description: "Rumah ini sudah memiliki peserta di kompetisi ini.",
        });
        return;
      }

      const finalTeamName = teamName.trim() || houseLabel(selectedHouse);
      const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
      const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

      createTeamMutation.mutate(
        {
          competition_id: competition.id,
          name: finalTeamName,
          house_id: selectedHouse,
          seed_number: nextSeed,
        },
        {
          onSuccess: async (team) => {
            if (selectedMembers.length > 0) {
              for (const userId of selectedMembers) {
                await addMemberMutation.mutateAsync({
                  team_id: team.id,
                  user_id: userId,
                  is_captain: userId === captainId,
                  competition_id: competition.id,
                });
              }
            }
            onOpenChange(false);
          },
        }
      );
    } else {
      // Batch mode: one team per selected house
      if (batchHouses.length === 0) return;
      const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
      let currentMaxSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) : 0;

      for (const houseId of batchHouses) {
        if (registeredHouseIds.has(houseId)) continue;
        if (isPaidEvent && !paidHouseIds.has(houseId)) continue;
        currentMaxSeed++;
        await createTeamMutation.mutateAsync({
          competition_id: competition.id,
          name: houseLabel(houseId),
          house_id: houseId,
          seed_number: currentMaxSeed,
        });
      }
      onOpenChange(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    if (captainId === userId && selectedMembers.includes(userId)) {
      setCaptainId("");
    }
  };

  const toggleBatchHouse = (houseId: string) => {
    setBatchHouses((prev) =>
      prev.includes(houseId) ? prev.filter((id) => id !== houseId) : [...prev, houseId]
    );
  };

  const isPending = createTeamMutation.isPending || addMemberMutation.isPending;
  const filteredProfiles = profiles?.filter((profile) =>
    profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBatchHouses = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    if (!q) return eligibleHouses;
    return eligibleHouses.filter((h) =>
      `${h.block} ${h.number}`.toLowerCase().includes(q)
    );
  }, [eligibleHouses, batchSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tambah Peserta</DialogTitle>
          <DialogDescription>
            Setiap peserta harus terhubung ke <span className="font-medium">nomor rumah</span>.
            {isPaidEvent && " Rumah harus sudah membayar untuk acara ini."}
          </DialogDescription>
        </DialogHeader>

        {isPaidEvent && (
          <Alert>
            <Wallet className="h-4 w-4" />
            <AlertTitle>Acara Berbayar</AlertTitle>
            <AlertDescription>
              {paidHouseIds.size} rumah sudah membayar. Hanya rumah yang sudah lunas dapat didaftarkan.
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
                : "Semua rumah sudah terdaftar di kompetisi ini."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "single" | "batch")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Satu Per Satu
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <ListPlus className="w-4 h-4" />
              Multi-Rumah
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <TabsContent value="single" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Nomor Rumah <span className="text-destructive">*</span></Label>
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
                      eligibleHouses.map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          Blok {house.block} No. {house.number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-name">Nama Peserta/Tim (Opsional)</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={selectedHouse ? houseLabel(selectedHouse) : "Nama tim atau peserta"}
                />
              </div>

              <div className="space-y-2">
                <Label>Pilih Anggota (Opsional)</Label>
                <Input
                  placeholder="Cari nama penghuni..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-2"
                />
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {filteredProfiles?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Tidak ada penghuni ditemukan
                    </div>
                  ) : (
                    filteredProfiles?.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/50 border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={selectedMembers.includes(profile.id)}
                          onCheckedChange={() => toggleMember(profile.id)}
                        />
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm line-clamp-1">{profile.full_name}</span>
                        {selectedMembers.includes(profile.id) && (
                          <Button
                            variant={captainId === profile.id ? "default" : "outline"}
                            size="sm"
                            className="text-xs h-6"
                            onClick={() => setCaptainId(captainId === profile.id ? "" : profile.id)}
                          >
                            Kapten
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4 mt-0">
              <p className="text-xs text-muted-foreground">
                Pilih beberapa rumah sekaligus. Setiap rumah akan didaftarkan sebagai satu peserta.
              </p>
              <Input
                placeholder="Cari rumah..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
              />
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {filteredBatchHouses.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Tidak ada rumah tersedia
                  </div>
                ) : (
                  filteredBatchHouses.map((house) => (
                    <label
                      key={house.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={batchHouses.includes(house.id)}
                        onCheckedChange={() => toggleBatchHouse(house.id)}
                      />
                      <span className="text-sm">Blok {house.block} No. {house.number}</span>
                    </label>
                  ))
                )}
              </div>
              {batchHouses.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {batchHouses.length} rumah dipilih
                </p>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              (activeMode === "single" && !selectedHouse) ||
              (activeMode === "batch" && batchHouses.length === 0)
            }
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {activeMode === "batch" ? `Daftarkan ${batchHouses.length || ""} Rumah` : "Tambah Peserta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
