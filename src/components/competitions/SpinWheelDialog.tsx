import { useState } from "react";
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
import { Trophy, RotateCw, X } from "lucide-react";
import type { CompetitionTeamWithMembers } from "@/types/competition";

interface SpinWheelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: CompetitionTeamWithMembers[];
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

// Polar -> cartesian. angle in degrees, 0 = top (12 o'clock), clockwise positive.
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

export function SpinWheelDialog({ open, onOpenChange, teams }: SpinWheelDialogProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<CompetitionTeamWithMembers | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const available = teams.filter((t) => !excludedIds.has(t.id));
  const n = available.length;
  const sliceAngle = n > 0 ? 360 / n : 0;

  const handleSpin = () => {
    if (spinning || n === 0) return;
    setWinner(null);
    const winnerIndex = Math.floor(Math.random() * n);
    const sliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    // Pointer at top (0°). We want sliceCenter to land at 0° after rotation R:
    //   (sliceCenter + R) mod 360 === 0  =>  R ≡ -sliceCenter (mod 360)
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - sliceCenter) % 360;
    let delta = desiredMod - currentMod;
    if (delta <= 0) delta += 360;
    const newRotation = rotation + 360 * 6 + delta;
    setSpinning(true);
    setRotation(newRotation);
    setTimeout(() => {
      setSpinning(false);
      setWinner(available[winnerIndex]);
    }, 4200);
  };

  const handleExcludeWinner = () => {
    if (!winner) return;
    setExcludedIds((s) => new Set(s).add(winner.id));
    setWinner(null);
  };

  const handleReset = () => {
    setExcludedIds(new Set());
    setWinner(null);
    setRotation(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Spin Wheel Peserta
          </DialogTitle>
          <DialogDescription>
            Putar roda untuk memilih peserta secara acak.
          </DialogDescription>
        </DialogHeader>

        {n === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Tidak ada peserta tersedia.
            {excludedIds.size > 0 && (
              <Button variant="link" onClick={handleReset} className="block mx-auto mt-2">
                Reset daftar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="relative" style={{ width: SIZE, height: SIZE }}>
              {/* Pointer */}
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
                  <circle cx={R} cy={R} r={R} fill={PALETTE[0]} />
                ) : (
                  available.map((team, i) => {
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

              {/* Center hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground border-4 border-background z-10" />
            </div>

            {winner && !spinning && (
              <div className="w-full p-4 rounded-lg bg-primary/10 border-2 border-primary text-center animate-in zoom-in">
                <p className="text-xs uppercase text-muted-foreground">Terpilih</p>
                <p className="text-xl font-bold">{winner.name}</p>
              </div>
            )}

            <div className="flex gap-2 w-full">
              <Button onClick={handleSpin} disabled={spinning} className="flex-1" size="lg">
                <RotateCw className={`w-4 h-4 mr-2 ${spinning ? "animate-spin" : ""}`} />
                {spinning ? "Memutar..." : winner ? "Putar Lagi" : "Putar"}
              </Button>
              {winner && !spinning && (
                <Button variant="outline" onClick={handleExcludeWinner} size="lg">
                  <X className="w-4 h-4 mr-1" />
                  Keluarkan
                </Button>
              )}
            </div>

            {excludedIds.size > 0 && (
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
