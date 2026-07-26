import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, RotateCw, X, Check, CheckCircle2, Loader2, User as UserIcon } from "lucide-react";
import type { CompetitionTeamWithMembers } from "@/types/competition";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { extractFlagAndName } from "@/lib/countries";
import { parseMemberName, capitalizeName } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface SpinWheelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: CompetitionTeamWithMembers[];
  competitionId?: string;
  /** When set, the wheel runs in "selection mode": each spin picks a participant
   *  until `targetCount` is reached, then `onApply` is called. */
  targetCount?: number;
  /** Whether targetCount can be edited by the user inside the dialog. */
  allowTargetEdit?: boolean;
  onApply?: (teamIds: string[]) => void;
  applying?: boolean;
  title?: string;
  description?: string;
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

export function SpinWheelDialog({
  open,
  onOpenChange,
  teams,
  targetCount,
  allowTargetEdit = false,
  onApply,
  applying = false,
  title = "Spin Wheel Peserta",
  description = "Putar roda untuk memilih peserta secara acak.",
  competitionId,
}: SpinWheelDialogProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<CompetitionTeamWithMembers | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();

  const loadSavedState = () => {
    if (competitionId) {
      try {
        const saved = localStorage.getItem(`spinwheel-excluded-${competitionId}`);
        if (saved) return new Set<string>(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
    return new Set<string>();
  };

  const [excludedIds, setExcludedIds] = useState<Set<string>>(loadSavedState);

  const handleSaveState = () => {
    if (competitionId) {
      localStorage.setItem(`spinwheel-excluded-${competitionId}`, JSON.stringify(Array.from(excludedIds)));
      toast({
        title: "Disimpan",
        description: "Pengaturan kandidat spinwheel berhasil disimpan.",
      });
    }
  };

  const [targetInput, setTargetInput] = useState<string>(String(targetCount ?? 2));

  const selectionMode = typeof targetCount === "number";
  const effectiveTarget = selectionMode
    ? Math.max(1, parseInt(targetInput, 10) || (targetCount ?? 1))
    : 0;

  // Reset whenever the dialog is reopened or pool changes meaningfully
  useEffect(() => {
    if (open) {
      setRotation(0);
      setSpinning(false);
      setWinner(null);
      setSelectedIds([]);
      setExcludedIds(loadSavedState());
      setTargetInput(String(targetCount ?? 2));
    }
  }, [open, targetCount]);

  const pool = teams.filter(
    (t) => !excludedIds.has(t.id) && !selectedIds.includes(t.id),
  );
  const n = pool.length;
  const sliceAngle = n > 0 ? 360 / n : 0;
  const reachedTarget = selectionMode && selectedIds.length >= effectiveTarget;

  const handleSpin = () => {
    if (spinning || n === 0 || reachedTarget) return;
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
      if (selectionMode && picked) {
        // Auto-add to selected and continue
        setSelectedIds((s) => [...s, picked.id]);
      }
    }, 4200);
  };

  const handleExcludeWinner = () => {
    if (!winner) return;
    setExcludedIds((s) => new Set(s).add(winner.id));
    setWinner(null);
  };

  const handleReset = () => {
    setExcludedIds(new Set());
    setSelectedIds([]);
    setWinner(null);
    setRotation(0);
  };

  const handleApply = () => {
    if (onApply && selectedIds.length > 0) {
      onApply(selectedIds);
    }
  };

  const selectedTeams = selectedIds
    .map((id) => teams.find((t) => t.id === id))
    .filter(Boolean) as CompetitionTeamWithMembers[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {selectionMode && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Target peserta</Label>
              {allowTargetEdit ? (
                <Input
                  type="number"
                  min={1}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!v || v < 1) setTargetInput("1");
                  }}
                  className="h-7 w-16 text-center"
                  disabled={spinning || selectedIds.length > 0}
                />
              ) : (
                <span className="font-semibold">{effectiveTarget}</span>
              )}
            </div>
            <span className="text-xs font-medium">
              {selectedIds.length} / {effectiveTarget} terpilih
            </span>
          </div>
        )}

        {teams.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border p-3 bg-muted/10">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-bold">Kandidat Spinwheel (Pilih yang ikut serta)</Label>
              {competitionId && (
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={handleSaveState}>
                  Simpan
                </Button>
              )}
            </div>
            <div className="max-h-24 overflow-y-auto grid grid-cols-2 gap-2 pr-1 scrollbar-thin">
              {teams.map((t) => {
                const isSelected = !excludedIds.has(t.id) && !selectedIds.includes(t.id);
                return (
                  <div key={t.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${t.id}`}
                      checked={isSelected}
                      disabled={spinning || selectedIds.includes(t.id)}
                      onCheckedChange={(checked) => {
                        setExcludedIds(prev => {
                          const next = new Set(prev);
                          if (checked) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        });
                      }}
                    />
                    <label
                      htmlFor={`team-${t.id}`}
                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate flex items-center gap-1.5"
                      title={t.name}
                    >
                      <TeamFlag team={t} className="w-4 h-3 object-cover rounded shadow-sm border border-border/30 shrink-0 text-[10px]" />
                      <span className="truncate">{extractFlagAndName(t.name).name}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {n === 0 && !reachedTarget ? (
          <div className="py-12 text-center text-muted-foreground">
            Tidak ada peserta tersedia.
            {(excludedIds.size > 0 || selectedIds.length > 0) && (
              <Button variant="link" onClick={handleReset} className="block mx-auto mt-2">
                Reset daftar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-4">
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
                {n === 0 ? (
                  <circle cx={R} cy={R} r={R} fill="hsl(var(--muted))" />
                ) : n === 1 ? (
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
                  pool.map((team, i) => {
                    const start = i * sliceAngle;
                    const end = (i + 1) * sliceAngle;
                    const mid = start + sliceAngle / 2;
                    const labelPos = polar(mid, R * 0.62);
                    return (
                      <g key={team.id}>
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
                          {team.name.length > 14 ? team.name.slice(0, 13) + "…" : team.name}
                        </text>
                      </g>
                    );
                  })
                )}
              </svg>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground border-4 border-background z-10" />
            </div>

            {winner && !spinning && (
              <div className="w-full p-4 rounded-xl bg-primary/10 border-2 border-primary text-center animate-in zoom-in shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">🎉 Tim Terpilih 🎉</p>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center gap-2">
                    <TeamFlag team={winner} className="w-8 h-6 object-cover rounded shadow-sm border border-border/30 text-2xl" />
                    <span className="text-2xl font-bold tracking-tight">{extractFlagAndName(winner.name).name}</span>
                  </div>
                  
                  {winner.members && winner.members.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mt-1">
                      {winner.members.map((m) => {
                        const parsed = parseMemberName(m.name);
                        const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Pemain");
                        const initial = name.charAt(0).toUpperCase();
                        const avatarUrl = parsed.avatarUrl || (m.profile as any)?.avatar_url || "";
                        
                        return (
                          <div key={m.id} className="flex items-center gap-2 bg-background/60 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm border border-border/40">
                            <Avatar className="w-5 h-5 border border-primary/20 shrink-0">
                              <AvatarImage src={avatarUrl} className="object-cover" />
                              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initial}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-semibold text-foreground pr-1">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 w-full">
              {n === 1 && !reachedTarget && !winner ? (
                <Button
                  onClick={() => {
                    setWinner(pool[0]);
                    setSelectedIds((prev) => [...prev, pool[0].id]);
                    // Auto apply if selectionMode
                    if (selectionMode && onApply) {
                      onApply([pool[0].id]);
                    }
                  }}
                  disabled={applying}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  size="lg"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Pilih & Terapkan Tim
                </Button>
              ) : (
                <Button
                  onClick={handleSpin}
                  disabled={spinning || reachedTarget || n === 0}
                  className="flex-1"
                  size="lg"
                >
                  <RotateCw className={`w-4 h-4 mr-2 ${spinning ? "animate-spin" : ""}`} />
                  {spinning
                    ? "Memutar..."
                    : reachedTarget
                      ? "Target tercapai"
                      : winner
                        ? "Putar Lagi"
                        : "Putar"}
                </Button>
              )}
              {!selectionMode && winner && !spinning && (
                <Button variant="outline" onClick={handleExcludeWinner} size="lg">
                  <X className="w-4 h-4 mr-1" />
                  Keluarkan
                </Button>
              )}
            </div>

            {selectionMode && selectedTeams.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Terpilih ({selectedTeams.length})
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleReset} disabled={applying}>
                    Reset
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTeams.map((t, i) => (
                    <Badge key={t.id} variant="default" className="gap-1">
                      <span className="text-[10px] opacity-70">#{i + 1}</span>
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!selectionMode && excludedIds.size > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">
                    Sudah keluar ({excludedIds.size})
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Reset
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {teams
                    .filter((t) => excludedIds.has(t.id))
                    .map((t) => (
                      <Badge key={t.id} variant="secondary">
                        {t.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Tutup
          </Button>
          {selectionMode && onApply && (
            <Button
              onClick={handleApply}
              disabled={!reachedTarget || applying}
              className="gap-2"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Terapkan ke Pertandingan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
