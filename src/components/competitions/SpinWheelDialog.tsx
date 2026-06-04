import { useState, useRef } from "react";
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

export function SpinWheelDialog({ open, onOpenChange, teams }: SpinWheelDialogProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<CompetitionTeamWithMembers | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const wheelRef = useRef<HTMLDivElement>(null);

  const available = teams.filter((t) => !excludedIds.has(t.id));
  const n = available.length;
  const sliceAngle = n > 0 ? 360 / n : 0;

  const handleSpin = () => {
    if (spinning || n === 0) return;
    setWinner(null);
    const winnerIndex = Math.floor(Math.random() * n);
    const extraSpins = 6;
    // Pointer at top (0deg). Each slice centered at i*slice + slice/2.
    // We want the chosen slice's center to land at 0 (top): rotation such that
    // (currentRot + sliceCenter) mod 360 === 0  =>  rotation = -sliceCenter + 360k
    const sliceCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const target = 360 * extraSpins + (360 - sliceCenter);
    const newRotation = rotation + (target - (rotation % 360));
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

  // Build conic gradient
  const conic = n > 0
    ? `conic-gradient(${available
        .map((_, i) => {
          const color = PALETTE[i % PALETTE.length];
          const from = i * sliceAngle;
          const to = (i + 1) * sliceAngle;
          return `${color} ${from}deg ${to}deg`;
        })
        .join(", ")})`
    : "hsl(var(--muted))";

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
            {/* Wheel */}
            <div className="relative w-72 h-72">
              {/* Pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-foreground drop-shadow-md" />
              </div>
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full border-4 border-foreground shadow-xl relative overflow-hidden"
                style={{
                  background: conic,
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? "transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)"
                    : "none",
                }}
              >
                {available.map((team, i) => {
                  const angle = i * sliceAngle + sliceAngle / 2;
                  return (
                    <div
                      key={team.id}
                      className="absolute top-1/2 left-1/2 origin-left text-xs font-bold text-white drop-shadow pointer-events-none"
                      style={{
                        transform: `rotate(${angle}deg) translateX(20px)`,
                        width: "110px",
                      }}
                    >
                      <span className="line-clamp-1">{team.name}</span>
                    </div>
                  );
                })}
              </div>
              {/* Center hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground border-4 border-background z-10" />
            </div>

            {/* Winner */}
            {winner && !spinning && (
              <div className="w-full p-4 rounded-lg bg-primary/10 border-2 border-primary text-center animate-in zoom-in">
                <p className="text-xs uppercase text-muted-foreground">Terpilih</p>
                <p className="text-xl font-bold">{winner.name}</p>
              </div>
            )}

            <div className="flex gap-2 w-full">
              <Button
                onClick={handleSpin}
                disabled={spinning}
                className="flex-1"
                size="lg"
              >
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
