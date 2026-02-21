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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  const [teamName, setTeamName] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>("");

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
    enabled: competition.participant_type === "house",
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
  });

  useEffect(() => {
    if (!open) {
      setTeamName("");
      setSelectedHouse("");
      setSelectedMembers([]);
      setCaptainId("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!teamName.trim()) return;

    const existingSeeds = competition.teams?.map(t => t.seed_number || 0) || [];
    const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

    createTeamMutation.mutate(
      {
        competition_id: competition.id,
        name: teamName,
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

  const [searchQuery, setSearchQuery] = useState("");

  const filteredProfiles = profiles?.filter((profile) =>
    profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Tim</DialogTitle>
          <DialogDescription>
            Daftarkan tim baru untuk kompetisi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Nama Tim *</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Masukkan nama tim"
            />
          </div>

          {/* House Selection for house-based competitions */}
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

          {/* Member Selection */}
          <div className="space-y-2">
            <Label>Anggota Tim</Label>
            <Input
              placeholder="Cari nama anggota..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {filteredProfiles?.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Tidak ada anggota ditemukan
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
            <p className="text-xs text-muted-foreground mt-2">
              {selectedMembers.length} anggota dipilih
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!teamName.trim() || isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Tambah Tim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
