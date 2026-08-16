import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Search, Users, Loader2, CheckSquare, Square, Check } from "lucide-react";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { extractFlagAndName } from "@/lib/countries";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { useToast } from "@/hooks/use-toast";
import { cn, getInitials } from "@/lib/utils";

interface CopyOtherMatchTeamsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

export function CopyOtherMatchTeamsModal({
  open,
  onOpenChange,
  competition,
}: CopyOtherMatchTeamsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>("all");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch teams from other competitions in the same event (or recent competitions)
  const { data: otherTeams = [], isLoading } = useQuery({
    queryKey: ["copy-modal-other-teams", competition.event_id, competition.id],
    queryFn: async () => {
      let competitionsData: { id: string; sport_name: string }[] = [];

      if (competition.event_id) {
        const { data } = await supabase
          .from("event_competitions")
          .select("id, sport_name")
          .eq("event_id", competition.event_id);
        if (data && data.length > 0) competitionsData = data;
      }

      if (competitionsData.length === 0) {
        const { data } = await supabase
          .from("event_competitions")
          .select("id, sport_name")
          .order("created_at", { ascending: false })
          .limit(30);
        if (data && data.length > 0) competitionsData = data;
      }

      const compIds = competitionsData.map((c) => c.id);
      if (compIds.length === 0) return [];

      const { data: teamsData, error } = await supabase
        .from("competition_teams")
        .select(`
          *,
          members:competition_team_members(*)
        `)
        .in("competition_id", compIds)
        .order("created_at", { ascending: false });

      if (error || !teamsData) {
        console.error("Error fetching other teams:", error);
        return [];
      }

      // Filter out teams that are already in this current competition if external teams exist
      const externalTeams = teamsData.filter((t: any) => t.competition_id !== competition.id);
      const displayTeams = externalTeams.length > 0 ? externalTeams : teamsData;

      return displayTeams.map((t: any) => {
        const comp = competitionsData.find((c) => c.id === t.competition_id);
        return {
          ...t,
          sport_name: comp?.sport_name || "Lomba Lain",
        };
      }) as (CompetitionTeamWithMembers & { sport_name: string })[];
    },
    enabled: open,
  });

  // Extract distinct sport names for filtering
  const availableSports = useMemo(() => {
    const sports = new Set<string>();
    otherTeams.forEach((t) => sports.add(t.sport_name));
    return Array.from(sports);
  }, [otherTeams]);

  // Filtered teams list based on search and sport dropdown
  const filteredTeams = useMemo(() => {
    return otherTeams.filter((t) => {
      const matchesSport =
        selectedSportFilter === "all" || t.sport_name === selectedSportFilter;
      if (!matchesSport) return false;

      if (!searchQuery.trim()) return true;

      const lower = searchQuery.toLowerCase();
      const nameMatch = (t.name || "").toLowerCase().includes(lower);
      const partNameMatch = (t.participant_name || "").toLowerCase().includes(lower);
      const houseMatch = (t.members?.[0]?.profile as any)?.house
        ? `blok ${((t.members[0].profile as any).house.block || "").toLowerCase()} no ${((t.members[0].profile as any).house.number || "").toLowerCase()}`.includes(lower)
        : false;

      return nameMatch || partNameMatch || houseMatch;
    });
  }, [otherTeams, selectedSportFilter, searchQuery]);

  const isAllSelected = filteredTeams.length > 0 && selectedTeamIds.length === filteredTeams.length;

  const toggleSelectTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTeamIds([]);
    } else {
      setSelectedTeamIds(filteredTeams.map((t) => t.id));
    }
  };

  const handleBulkCopy = async () => {
    if (selectedTeamIds.length === 0) return;
    setIsSubmitting(true);

    try {
      const selectedTeamsData = otherTeams.filter((t) =>
        selectedTeamIds.includes(t.id)
      );

      const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
      let currentSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

      let copiedCount = 0;

      for (const srcTeam of selectedTeamsData) {
        // Insert team into target competition
        const { data: newTeam, error: teamErr } = await supabase
          .from("competition_teams")
          .insert({
            competition_id: competition.id,
            name: srcTeam.name,
            participant_name: srcTeam.participant_name || srcTeam.name,
            house_id: srcTeam.house_id || null,
            user_id: srcTeam.user_id || null,
            seed_number: currentSeed++,
            logo_url: srcTeam.logo_url || null,
            age: srcTeam.age || null,
            age_group: srcTeam.age_group || null,
            gender: srcTeam.gender || null,
            is_individual: srcTeam.is_individual ?? true,
          })
          .select()
          .single();

        if (teamErr || !newTeam) {
          console.error("Gagal menyalin tim:", teamErr);
          continue;
        }

        // Copy member entries if any
        if (srcTeam.members && srcTeam.members.length > 0) {
          const memberInserts = srcTeam.members.map((m) => ({
            team_id: newTeam.id,
            user_id: m.user_id || null,
            name: m.name || null,
            is_captain: m.is_captain || false,
          }));

          await supabase.from("competition_team_members").insert(memberInserts);
        }

        copiedCount++;
      }

      toast({
        title: "Peserta Berhasil Disalin!",
        description: `${copiedCount} peserta/tim telah ditambahkan ke kompetisi ${competition.sport_name}.`,
      });

      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
      setSelectedTeamIds([]);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal Menyalin Peserta",
        description: err.message || "Terjadi kesalahan saat menyalin peserta.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Copy className="w-4 h-4" />
            </div>
            Salin Peserta dari Match / Lomba Lain
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih peserta atau tim dari lomba lain untuk didaftarkan langsung ke kompetisi{" "}
            <span className="font-semibold text-foreground">{competition.sport_name}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Cari nama peserta / blok rumah..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={selectedSportFilter} onValueChange={setSelectedSportFilter}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="Semua Lomba Asal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Semua Lomba Asal
              </SelectItem>
              {availableSports.map((sport) => (
                <SelectItem key={sport} value={sport} className="text-xs">
                  {sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Participant List Container */}
        <div className="flex-1 min-h-[260px] max-h-[380px] overflow-y-auto border rounded-xl p-3 bg-muted/10 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">Memuat daftar peserta dari lomba lain...</span>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 opacity-30 mb-2" />
              <p className="text-xs font-medium">Tidak ada peserta ditemukan</p>
              <p className="text-[11px] text-muted-foreground/70">
                {searchQuery
                  ? "Coba gunakan kata kunci pencarian yang lain."
                  : "Belum ada data peserta dari pertandingan/lomba lain."}
              </p>
            </div>
          ) : (
            <>
              {/* Header with Select All button */}
              <div className="flex items-center justify-between pb-2 border-b px-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Daftar Peserta ({filteredTeams.length})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 gap-1.5"
                >
                  {isAllSelected ? (
                    <>
                      <CheckSquare className="w-4 h-4" /> Batal Pilih Semua
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" /> Pilih Semua ({filteredTeams.length})
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-1.5 pt-1">
                {filteredTeams.map((t) => {
                  const isSelected = selectedTeamIds.includes(t.id);
                  const parsedMember = t.members?.[0]?.name
                    ? extractFlagAndName(t.members[0].name)
                    : null;
                  const displayName = extractFlagAndName(t.name || t.participant_name || "Tanpa Nama").name;
                  const house = (t.members?.[0]?.profile as any)?.house;

                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleSelectTeam(t.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectTeam(t.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />

                        <TeamFlag team={t} className="w-6 h-4 object-cover rounded shadow-sm shrink-0 border border-border/20" />

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate text-xs">
                            {displayName}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/50">
                              {t.sport_name}
                            </Badge>
                            {house && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Blok {house.block} No. {house.number}
                              </Badge>
                            )}
                            {t.age != null && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {t.age} thn
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-primary text-[10px] font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full shrink-0 ml-2">
                          Terpilih
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleBulkCopy}
            disabled={selectedTeamIds.length === 0 || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Salin ({selectedTeamIds.length}) Peserta ke Kompetisi Ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
