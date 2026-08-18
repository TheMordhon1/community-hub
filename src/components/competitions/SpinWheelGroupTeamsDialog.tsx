import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCw, Sparkles, CheckCircle2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";

interface SpinWheelGroupTeamsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

const PALETTE = [
  "hsl(0 72% 60%)",
  "hsl(30 90% 55%)",
  "hsl(48 95% 55%)",
  "hsl(140 60% 50%)",
  "hsl(190 75% 50%)",
  "hsl(220 75% 60%)",
  "hsl(270 65% 60%)",
  "hsl(320 70% 60%)",
];

const SIZE = 288;
const R = SIZE / 2;

function polar(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: R + radius * Math.cos(rad), y: R + radius * Math.sin(rad) };
}

function slicePath(startAngle: number, endAngle: number) {
  const start = polar(startAngle, R);
  const end = polar(endAngle, R);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${R} ${R} L ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export function SpinWheelGroupTeamsDialog({
  open,
  onOpenChange,
  competition,
}: SpinWheelGroupTeamsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Find all individual teams in this competition (those with is_individual === true)
  const unassignedTeams = useMemo(() => {
    return (competition.teams || []).filter((t) => t.is_individual);
  }, [competition.teams]);

  // States
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<CompetitionTeamWithMembers | null>(null);
  
  // Track players picked for the current team being built
  const [currentPicked, setCurrentPicked] = useState<CompetitionTeamWithMembers[]>([]);
  // Track players already grouped (so we exclude them from the wheel)
  const [groupedIds, setGroupedIds] = useState<Set<string>>(new Set());
  
  const [saving, setSaving] = useState(false);

  // Pool of players available for spin
  const pool = unassignedTeams.filter(
    (t) => !groupedIds.has(t.id) && !currentPicked.some((p) => p.id === t.id)
  );

  const n = pool.length;
  const sliceAngle = n > 0 ? 360 / n : 0;

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setRotation(0);
      setSpinning(false);
      setWinner(null);
      setCurrentPicked([]);
      setGroupedIds(new Set());
    }
  }, [open]);

  const handleSpin = () => {
    if (spinning || n === 0 || currentPicked.length >= teamSize) return;
    setWinner(null);
    const winnerIndex = Math.floor(Math.random() * n);
    const sliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - sliceCenter) % 360;
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    const newRotation = rotation + 360 * 6 + delta;
    setSpinning(true);
    setRotation(newRotation);
    
    setTimeout(() => {
      setSpinning(false);
      const picked = pool[winnerIndex];
      setWinner(picked);
      if (picked) {
        setCurrentPicked((prev) => [...prev, picked]);
      }
    }, 4200);
  };

  const handleSaveTeam = async (playersToGroup: CompetitionTeamWithMembers[]) => {
    if (playersToGroup.length === 0) return;
    setSaving(true);
    try {
      const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
      const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

      // Construct team name from players
      const generatedName = playersToGroup.map((p) => p.name).join(" & ");

      // 1. Create a new team
      const { data: newTeam, error: teamError } = await supabase
        .from("competition_teams")
        .insert({
          competition_id: competition.id,
          name: generatedName,
          participant_name: generatedName,
          is_individual: false,
          seed_number: nextSeed,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // 2. Insert member records
      // Copy user_ids and manual names from the picked teams
      const memberInserts = playersToGroup.map((p, index) => {
        // Since each individual registrant team has 1 member or is stored directly,
        // let's copy their details. If they have a user_id, link it, otherwise copy name.
        return {
          team_id: newTeam.id,
          user_id: p.user_id || null,
          name: p.user_id ? null : p.name,
          is_captain: index === 0,
        };
      });

      const { error: membersError } = await supabase
        .from("competition_team_members")
        .insert(memberInserts);

      if (membersError) throw membersError;

      // 3. Delete old individual teams
      const oldTeamIds = playersToGroup.map((p) => p.id);
      const { error: deleteError } = await supabase
        .from("competition_teams")
        .delete()
        .in("id", oldTeamIds);

      if (deleteError) throw deleteError;

      // 4. Update local grouped list
      setGroupedIds((prev) => {
        const next = new Set(prev);
        oldTeamIds.forEach((id) => next.add(id));
        return next;
      });

      toast({
        title: "Tim Terbentuk!",
        description: `Tim "${generatedName}" berhasil dibuat.`,
      });

      // Clear current team state
      setCurrentPicked([]);
      setWinner(null);

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({
        queryKey: ["competition-details", competition.id],
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan Tim",
        description: "Terjadi kesalahan saat memproses penggabungan tim.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGroupAll = async () => {
    if (unassignedTeams.length < teamSize) {
      toast({
        variant: "destructive",
        title: "Jumlah tidak cukup",
        description: `Minimal butuh ${teamSize} peserta untuk membentuk tim.`,
      });
      return;
    }
    setSaving(true);
    try {
      // Shuffle unassigned teams
      const shuffled = [...unassignedTeams].sort(() => Math.random() - 0.5);
      
      let createdCount = 0;
      const existingSeeds = competition.teams?.map((t) => t.seed_number || 0) || [];
      let nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;

      // Group into chunks of teamSize
      for (let i = 0; i + teamSize <= shuffled.length; i += teamSize) {
        const chunk = shuffled.slice(i, i + teamSize);
        const generatedName = chunk.map((p) => p.name).join(" & ");

        // 1. Create Team
        const { data: newTeam, error: teamError } = await supabase
          .from("competition_teams")
          .insert({
            competition_id: competition.id,
            name: generatedName,
            participant_name: generatedName,
            is_individual: false,
            seed_number: nextSeed++,
          })
          .select()
          .single();

        if (teamError) throw teamError;

        // 2. Insert Members
        const memberInserts = chunk.map((p, index) => ({
          team_id: newTeam.id,
          user_id: p.user_id || null,
          name: p.user_id ? null : p.name,
          is_captain: index === 0,
        }));

        const { error: membersError } = await supabase
          .from("competition_team_members")
          .insert(memberInserts);

        if (membersError) throw membersError;

        // 3. Delete old teams
        const oldTeamIds = chunk.map((p) => p.id);
        const { error: deleteError } = await supabase
          .from("competition_teams")
          .delete()
          .in("id", oldTeamIds);

        if (deleteError) throw deleteError;

        createdCount++;
      }

      toast({
        title: "Berhasil!",
        description: `${createdCount} tim berhasil terbentuk secara acak.`,
      });

      queryClient.invalidateQueries({
        queryKey: ["competition-details", competition.id],
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal Acak Tim",
        description: "Terjadi kesalahan saat membagi tim otomatis.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Bagi Tim via Spin Wheel ({competition.match_type})
          </DialogTitle>
          <DialogDescription>
            Tentukan anggota tim secara acak dengan memutar roda. Setiap tim terdiri dari {teamSize} orang.
          </DialogDescription>
        </DialogHeader>

        {unassignedTeams.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Tidak ada pendaftar individu yang belum berpasangan.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-2">
            {/* Current team slots */}
            <div className="w-full border rounded-lg p-3 bg-primary/5 border-primary/20 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Tim Baru Sedang Dibentuk ({currentPicked.length} / {teamSize})
              </h4>
              <div className="grid gap-2">
                {Array.from({ length: teamSize }).map((_, idx) => {
                  const player = currentPicked[idx];
                  return (
                    <div
                      key={idx}
                      className={`h-10 rounded-md border flex items-center px-3 text-sm font-medium ${
                        player
                          ? "bg-background border-primary/30 text-foreground"
                          : "bg-muted/40 border-dashed text-muted-foreground"
                      }`}
                    >
                      {player ? (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Slot {idx + 1}</Badge>
                          <span>{player.name}</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1.5 opacity-60">
                          <UserPlus className="w-4 h-4" /> Menunggu putaran roda...
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {currentPicked.length === teamSize && (
                <Button
                  onClick={() => handleSaveTeam(currentPicked)}
                  className="w-full mt-2"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Simpan & Buat Tim Ini
                </Button>
              )}
            </div>

            {/* Spin Wheel area */}
            {n > 0 && currentPicked.length < teamSize ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative" style={{ width: SIZE, height: SIZE }}>
                  <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
                    <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-foreground drop-shadow-md" />
                  </div>

                  <svg
                    width={SIZE}
                    height={SIZE}
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    className="rounded-full border-4 border-foreground shadow-xl"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning
                        ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)"
                        : "none",
                    }}
                  >
                    {n === 1 ? (
                      <>
                        <circle cx={R} cy={R} r={R} fill={PALETTE[0]} />
                        <text
                          x={R}
                          y={R}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize={14}
                          fontWeight={700}
                        >
                          {pool[0].name.length > 16 ? pool[0].name.slice(0, 15) + "…" : pool[0].name}
                        </text>
                      </>
                    ) : (
                      pool.map((p, i) => {
                        const start = i * sliceAngle;
                        const end = (i + 1) * sliceAngle;
                        const mid = start + sliceAngle / 2;
                        const labelPos = polar(mid, R * 0.62);
                        return (
                          <g key={p.id}>
                            <path
                              d={slicePath(start, end)}
                              fill={PALETTE[i % PALETTE.length]}
                              stroke="white"
                              strokeWidth={2}
                            />
                            <text
                              x={labelPos.x}
                              y={labelPos.y}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="white"
                              fontSize={n > 8 ? 10 : 13}
                              fontWeight={700}
                              transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                              style={{ pointerEvents: "none" }}
                            >
                              {p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}
                            </text>
                          </g>
                        );
                      })
                    )}
                  </svg>

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground border-4 border-background z-10" />
                </div>

                {winner && !spinning && (
                  <div className="w-full p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-center animate-in zoom-in">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Terpilih</p>
                    <p className="text-base font-bold text-primary">{winner.name}</p>
                  </div>
                )}

                <Button
                  onClick={handleSpin}
                  disabled={spinning || saving}
                  className="w-48"
                >
                  <RotateCw className={`w-4 h-4 mr-2 ${spinning ? "animate-spin" : ""}`} />
                  {spinning ? "Memutar..." : "Putar Roda"}
                </Button>
              </div>
            ) : (
              n === 0 && currentPicked.length < teamSize && (
                <div className="py-6 text-center text-muted-foreground">
                  Semua peserta individu telah dikelompokkan ke dalam tim.
                </div>
              )
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {unassignedTeams.length >= teamSize && (
            <Button
              variant="outline"
              onClick={handleAutoGroupAll}
              disabled={saving || spinning}
              className="mr-auto gap-1"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              Bagi Semua Otomatis
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || spinning}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
