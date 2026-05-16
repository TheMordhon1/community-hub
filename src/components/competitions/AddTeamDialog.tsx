import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Trash2, Users, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateTeam, useAddTeamMember } from "@/hooks/useCompetitions";
import { getInitials } from "@/lib/utils";
import type { EventCompetitionWithDetails } from "@/types/competition";
import type { Profile, House } from "@/types/database";

interface AddTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

export function AddTeamDialog({ open, onOpenChange, competition }: AddTeamDialogProps) {
  const [activeMode, setActiveMode] = useState<"single" | "batch">("single");
  const [teamName, setTeamName] = useState("");
  const [batchNames, setBatchNames] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const createTeamMutation = useCreateTeam();
  const addMemberMutation = useAddTeamMember();

  // Fetch houses for house-based competitions
  const { data: houses } = useQuery({
    queryKey: ["houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block", { ascending: true })
        .order("number", { ascending: true });
      if (error) throw error;
      return data as House[];
    },
    enabled: competition.participant_type === "house" && open,
  });

  // Fetch all profiles for member selection
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
    enabled: open && activeMode === "single",
  });

  useEffect(() => {
    if (!open) {
      setTeamName("");
      setBatchNames("");
      setSelectedHouse("");
      setSelectedMembers([]);
      setCaptainId("");
      setSearchQuery("");
      setActiveMode("single");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (activeMode === "single") {
      const existingTeamsCount = competition.teams?.length || 0;
      const finalTeamName = teamName.trim() || `Team ${String.fromCharCode(65 + (existingTeamsCount % 26))}${existingTeamsCount >= 26 ? Math.floor(existingTeamsCount / 26) + 1 : ""}`;

      const existingSeeds = competition.teams?.map(t => t.seed_number || 0) || [];
      const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

      createTeamMutation.mutate(
        {
          competition_id: competition.id,
          name: finalTeamName,
          house_id: selectedHouse || undefined,
          seed_number: nextSeed,
        },
        {
          onSuccess: async (team) => {
            // Add members if any selected
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
      // Batch mode
      const names = batchNames
        .split("\n")
        .map(n => n.trim())
        .filter(n => n.length > 0);
      
      if (names.length === 0) return;

      const existingSeeds = competition.teams?.map(t => t.seed_number || 0) || [];
      let currentMaxSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) : 0;

      for (const name of names) {
        currentMaxSeed++;
        await createTeamMutation.mutateAsync({
          competition_id: competition.id,
          name,
          seed_number: currentMaxSeed,
        });
      }
      onOpenChange(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
    // Reset captain if removed
    if (captainId === userId && selectedMembers.includes(userId)) {
      setCaptainId("");
    }
  };

  const isPending = createTeamMutation.isPending || addMemberMutation.isPending;
  const filteredProfiles = profiles?.filter((profile) =>
    profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tambah Peserta/Tim</DialogTitle>
          <DialogDescription>
            Daftarkan tim atau peserta baru untuk kompetisi
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as "single" | "batch")} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Satu Per Satu
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <ListPlus className="w-4 h-4" />
              Cepat (Custom)
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            <TabsContent value="single" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="team-name">Nama Peserta/Tim (Opsional)</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={`contoh: Team ${String.fromCharCode(65 + ((competition.teams?.length || 0) % 26))}`}
                />
              </div>

              {competition.participant_type === "house" && houses && (
                <div className="space-y-2">
                  <Label>Rumah (Opsional)</Label>
                  <Select value={selectedHouse} onValueChange={setSelectedHouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih rumah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tidak ada</SelectItem>
                      {houses.map((house) => (
                        <SelectItem key={house.id} value={house.id}>
                          Blok {house.block} No. {house.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                          <AvatarFallback>
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm line-clamp-1">
                          {profile.full_name}
                        </span>
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
              <div className="space-y-2">
                <Label htmlFor="batch-names">Daftar Nama (Satu nama per baris)</Label>
                <Textarea
                  id="batch-names"
                  value={batchNames}
                  onChange={(e) => setBatchNames(e.target.value)}
                  placeholder="Budi&#10;Iwan&#10;Susi"
                  rows={10}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan cara ini untuk menambah banyak peserta sekaligus tanpa harus memilih satu per satu.
                </p>
              </div>
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
              (activeMode === "batch" && !batchNames.trim()) || 
              isPending
            }
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {activeMode === "batch" ? "Tambah Semua" : "Tambah Tim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
