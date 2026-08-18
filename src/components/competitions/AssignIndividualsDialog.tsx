import { useState, useMemo, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Loader2, Plus, CheckCircle2, UserMinus, UserPlus,
  Users, ArrowLeft, Shuffle, Sparkles, RotateCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";

interface AssignIndividualsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
}

// ─── Spin Wheel Helpers ────────────────────────────────────────────────────
const PALETTE = [
  "hsl(0 72% 60%)", "hsl(30 90% 55%)", "hsl(48 95% 55%)", "hsl(140 60% 50%)",
  "hsl(190 75% 50%)", "hsl(220 75% 60%)", "hsl(270 65% 60%)", "hsl(320 70% 60%)",
];
const SIZE = 240;
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

type Step = "create" | "assign";
type AssignMethod = "manual" | "spin";

export function AssignIndividualsDialog({
  open,
  onOpenChange,
  competition,
}: AssignIndividualsDialogProps) {
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

  const allIndividuals = useMemo(
    () => (competition.teams || []).filter((t) => t.is_individual),
    [competition.teams]
  );

  // ─── State ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("create");
  const [teamName, setTeamName] = useState("");
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);
  const [createdTeamName, setCreatedTeamName] = useState("");
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<AssignMethod>("manual");

  // Spin wheel state
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [spinWinner, setSpinWinner] = useState<CompetitionTeamWithMembers | null>(null);

  // Pool of individuals not yet assigned to this team
  const pool = allIndividuals.filter((t) => !assignedIds.has(t.id));
  const slotsRemaining = teamSize - assignedIds.size;
  const isFull = slotsRemaining <= 0;

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("create");
      setTeamName("");
      setCreatedTeamId(null);
      setCreatedTeamName("");
      setAssignedIds(new Set());
      setMethod("manual");
      setRotation(0);
      setSpinning(false);
      setSpinWinner(null);
    }
  }, [open]);

  // ─── Step 1: Create Empty Team ────────────────────────────────────────────
  const handleCreateTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const existingSeeds = (competition.teams || []).map((t) => t.seed_number || 0);
      const nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;
      const { data, error } = await supabase
        .from("competition_teams")
        .insert({
          competition_id: competition.id,
          name,
          participant_name: name,
          is_individual: false,
          seed_number: nextSeed,
        })
        .select()
        .single();
      if (error) throw error;
      setCreatedTeamId(data.id);
      setCreatedTeamName(name);
      setStep("assign");
      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membuat tim." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Add one individual as member ────────────────────────────────────────
  const addMember = async (individual: CompetitionTeamWithMembers) => {
    if (!createdTeamId || isFull) return;
    const isFirst = assignedIds.size === 0;
    setSaving(true);
    try {
      // 1. Insert as member
      const { error: mErr } = await supabase.from("competition_team_members").insert({
        team_id: createdTeamId,
        user_id: individual.user_id || null,
        name: individual.user_id ? null : individual.name,
        is_captain: isFirst,
      });
      if (mErr) throw mErr;
      // 2. Delete old individual entry
      const { error: dErr } = await supabase
        .from("competition_teams")
        .delete()
        .eq("id", individual.id);
      if (dErr) throw dErr;

      setAssignedIds((prev) => new Set([...prev, individual.id]));
      setSpinWinner(null);
      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menambahkan anggota." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Random fill remaining slots ─────────────────────────────────────────
  const handleRandomFill = async () => {
    if (!createdTeamId || pool.length === 0) return;
    const toAdd = [...pool].sort(() => Math.random() - 0.5).slice(0, slotsRemaining);
    setSaving(true);
    try {
      for (const individual of toAdd) {
        const isFirst = assignedIds.size === 0;
        const { error: mErr } = await supabase.from("competition_team_members").insert({
          team_id: createdTeamId,
          user_id: individual.user_id || null,
          name: individual.user_id ? null : individual.name,
          is_captain: isFirst,
        });
        if (mErr) throw mErr;
        const { error: dErr } = await supabase
          .from("competition_teams").delete().eq("id", individual.id);
        if (dErr) throw dErr;
        assignedIds.add(individual.id);
      }
      setAssignedIds(new Set(assignedIds));
      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
      toast({ title: "Berhasil!", description: `${toAdd.length} anggota ditambahkan secara acak.` });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengacak anggota." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Spin Wheel ───────────────────────────────────────────────────────────
  const n = pool.length;
  const sliceAngle = n > 0 ? 360 / n : 0;
  const handleSpin = () => {
    if (spinning || n === 0 || isFull) return;
    setSpinWinner(null);
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
      setSpinWinner(pool[winnerIndex]);
    }, 4200);
  };

  const handleDone = () => {
    onOpenChange(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "assign" && (
              <button
                onClick={() => setStep("create")}
                className="text-muted-foreground hover:text-foreground mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Users className="w-5 h-5 text-primary" />
            {step === "create" ? "Buat Tim Baru" : `Tambah Anggota — ${createdTeamName}`}
          </DialogTitle>
          <DialogDescription>
            {step === "create"
              ? "Masukkan nama tim terlebih dahulu. Anggota akan ditambahkan setelahnya."
              : `Tambahkan ${teamSize} anggota ke tim ini. Sisa slot: ${slotsRemaining}.`}
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: Create Team ── */}
        {step === "create" && (
          <div className="space-y-4 py-2">
            {allIndividuals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Tidak ada pendaftar individu yang tersedia.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="newTeamName">Nama Tim</Label>
                  <Input
                    id="newTeamName"
                    placeholder="Contoh: Tim Garuda, Tim Merah..."
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !saving && teamName.trim() && handleCreateTeam()}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {allIndividuals.length} pendaftar individu tersedia · Tim berisi {teamSize} orang ({competition.match_type})
                </p>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Assign Members ── */}
        {step === "assign" && (
          <div className="space-y-4">
            {/* Team name input (editable at top) */}
            <div className="space-y-1.5">
              <Label htmlFor="assignTeamName">Nama Tim</Label>
              <Input
                id="assignTeamName"
                value={createdTeamName}
                onChange={async (e) => {
                  const newName = e.target.value;
                  setCreatedTeamName(newName);
                  if (createdTeamId && newName.trim()) {
                    await supabase
                      .from("competition_teams")
                      .update({ name: newName.trim(), participant_name: newName.trim() })
                      .eq("id", createdTeamId);
                    queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
                  }
                }}
                placeholder="Nama tim..."
              />
            </div>

            {/* Slot progress */}
            <div className="border rounded-lg p-3 bg-primary/5 border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  Slot Terisi ({assignedIds.size} / {teamSize})
                </h4>
                {isFull && (
                  <Badge className="bg-green-500/15 text-green-600 border-green-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Penuh
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: teamSize }).map((_, idx) => {
                  const filled = idx < assignedIds.size;
                  return (
                    <div
                      key={idx}
                      className={`flex-1 min-w-[60px] h-8 rounded-md border flex items-center justify-center text-xs font-medium transition-colors ${
                        filled
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-muted/40 border-dashed text-muted-foreground"
                      }`}
                    >
                      {filled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5 opacity-40" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Method toggle */}
            {!isFull && (
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant={method === "manual" ? "default" : "outline"}
                  onClick={() => setMethod("manual")}
                  className="flex-1 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Manual
                </Button>
                <Button
                  size="sm"
                  variant={method === "spin" ? "default" : "outline"}
                  onClick={() => setMethod("spin")}
                  className="flex-1 gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Spin Wheel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRandomFill}
                  disabled={saving || pool.length === 0}
                  className="flex-1 gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Acak
                </Button>
              </div>
            )}

            {/* Manual pick */}
            {!isFull && method === "manual" && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Pendaftar Individu ({pool.length} tersisa)
                </h4>
                <div className="grid gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {pool.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-4">
                      Tidak ada pendaftar individu tersisa.
                    </p>
                  ) : (
                    pool.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addMember(p)}
                        disabled={saving}
                        className="flex items-center justify-between px-3 py-2 rounded-md border text-sm text-left bg-background hover:bg-muted/60 border-border transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium truncate">{p.name}</span>
                        <Plus className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Spin Wheel */}
            {!isFull && method === "spin" && (
              <div className="flex flex-col items-center gap-3">
                {pool.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Tidak ada pendaftar tersisa di roda.
                  </p>
                ) : (
                  <>
                    <div className="relative" style={{ width: SIZE, height: SIZE }}>
                      {/* pointer */}
                      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
                        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[18px] border-t-foreground drop-shadow-md" />
                      </div>
                      <svg
                        width={SIZE} height={SIZE}
                        viewBox={`0 0 ${SIZE} ${SIZE}`}
                        className="rounded-full border-4 border-foreground shadow-xl"
                        style={{
                          transform: `rotate(${rotation}deg)`,
                          transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)" : "none",
                        }}
                      >
                        {n === 1 ? (
                          <>
                            <circle cx={R} cy={R} r={R} fill={PALETTE[0]} />
                            <text x={R} y={R} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={13} fontWeight={700}>
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
                                <path d={slicePath(start, end)} fill={PALETTE[i % PALETTE.length]} stroke="white" strokeWidth={2} />
                                <text
                                  x={labelPos.x} y={labelPos.y}
                                  textAnchor="middle" dominantBaseline="middle"
                                  fill="white" fontSize={n > 8 ? 9 : 12} fontWeight={700}
                                  transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                                  style={{ pointerEvents: "none" }}
                                >
                                  {p.name.length > 12 ? p.name.slice(0, 11) + "…" : p.name}
                                </text>
                              </g>
                            );
                          })
                        )}
                      </svg>
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-foreground border-4 border-background z-10" />
                    </div>

                    {spinWinner && !spinning && (
                      <div className="w-full p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-center animate-in zoom-in space-y-2">
                        <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Terpilih</p>
                        <p className="text-base font-bold text-primary">{spinWinner.name}</p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => addMember(spinWinner)}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                          Tambahkan ke Tim
                        </Button>
                      </div>
                    )}

                    <Button onClick={handleSpin} disabled={spinning || saving} className="w-44">
                      <RotateCw className={`w-4 h-4 mr-2 ${spinning ? "animate-spin" : ""}`} />
                      {spinning ? "Memutar..." : "Putar Roda"}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Done state */}
            {isFull && (
              <div className="text-center py-2 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="font-semibold text-green-600">Tim "{createdTeamName}" sudah penuh!</p>
                <p className="text-xs text-muted-foreground">Anda dapat menutup dialog atau membuat tim baru.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep("create");
                    setTeamName("");
                    setCreatedTeamId(null);
                    setAssignedIds(new Set());
                    setSpinWinner(null);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" /> Buat Tim Lain
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "create" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Batal
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={saving || !teamName.trim() || allIndividuals.length === 0}
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Buat Tim
              </Button>
            </>
          ) : (
            <Button onClick={handleDone} variant={isFull ? "default" : "ghost"}>
              {isFull ? "Selesai" : "Tutup"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
