import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  RotateCw,
  X,
  Gift,
  CheckCircle2,
  Save,
  RotateCcw,
} from "lucide-react";
import confetti from "canvas-confetti";
import type { House } from "@/types/database";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { useToast } from "@/hooks/use-toast";

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

const SIZE = 320;
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

export default function DoorPrize() {
  const { naturalSort } = useNaturalSort();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<House[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<House | null>(null);
  const [search, setSearch] = useState("");

  const { data: houses, isLoading: housesLoading } = useQuery({
    queryKey: ["houses-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("houses").select("*");
      if (error) throw error;
      return (data as House[]).sort((a, b) => {
        const blockSort = naturalSort(a.block, b.block);
        if (blockSort !== 0) return blockSort;
        return naturalSort(a.number, b.number);
      });
    },
  });

  const { data: houseMembers, isLoading: membersLoading } = useQuery({
    queryKey: ["house_members-approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const savedCandidates = localStorage.getItem("doorPrizeCandidates");
    const savedExcluded = localStorage.getItem("doorPrizeExcluded");
    if (savedCandidates && houses) {
      try {
        const candidateIds = JSON.parse(savedCandidates) as string[];
        const selected = houses.filter((h) => candidateIds.includes(h.id));
        setCandidates(selected);
      } catch (e) {
        console.log(e);
      }
    }
    if (savedExcluded) {
      try {
        setExcludedIds(new Set(JSON.parse(savedExcluded)));
      } catch (e) {
        console.log(e);
      }
    }
  }, [houses]);

  const saveState = (newCandidates: House[], newExcluded: Set<string>) => {
    localStorage.setItem(
      "doorPrizeCandidates",
      JSON.stringify(newCandidates.map((c) => c.id)),
    );
    localStorage.setItem(
      "doorPrizeExcluded",
      JSON.stringify(Array.from(newExcluded)),
    );
  };

  const handleSelectAllOccupied = () => {
    if (!houses || !houseMembers) return;
    const occupiedHouseIds = new Set(
      houseMembers.map((m) => m.house_id).filter(Boolean),
    );
    const occupiedHouses = houses.filter((h) => occupiedHouseIds.has(h.id));
    setCandidates(occupiedHouses);
    setExcludedIds(new Set());
    setWinner(null);
    setRotation(0);
    saveState(occupiedHouses, new Set());
    toast({
      title: "Berhasil",
      description: "Semua rumah berpenghuni telah dipilih dan disimpan.",
    });
  };

  const handleExplicitSave = () => {
    saveState(candidates, excludedIds);
    toast({
      title: "Tersimpan",
      description: "Daftar kandidat berhasil disimpan.",
    });
  };

  const handleRestartSession = () => {
    setExcludedIds(new Set());
    setWinner(null);
    setRotation(0);
    saveState(candidates, new Set());
    toast({
      title: "Sesi Diulang",
      description: "Semua rumah yang sudah mendapat door prize direset.",
    });
  };

  const handleClear = () => {
    setCandidates([]);
    setExcludedIds(new Set());
    setWinner(null);
    setRotation(0);
    saveState([], new Set());
  };

  const handleToggleHouse = (house: House) => {
    const isSelected = candidates.some((c) => c.id === house.id);
    let newCandidates: House[];
    if (isSelected) {
      newCandidates = candidates.filter((c) => c.id !== house.id);
    } else {
      newCandidates = [...candidates, house];
    }
    setCandidates(newCandidates);
  };

  const pool = candidates.filter((c) => !excludedIds.has(c.id));
  const n = pool.length;
  const sliceAngle = n > 0 ? 360 / n : 0;

  const handleSpin = () => {
    if (spinning || n === 0) return;
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 4200);
  };

  const markWinner = () => {
    if (!winner) return;
    const nextExcluded = new Set(excludedIds).add(winner.id);
    setExcludedIds(nextExcluded);
    setWinner(null);
    saveState(candidates, nextExcluded);
  };

  const filteredHouses =
    houses?.filter((h) =>
      `${h.block}${h.number}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Gift className="w-8 h-8 text-primary" />
            Door Prize Session
          </h1>
          <p className="text-muted-foreground mt-1">
            Acak rumah untuk mendapatkan door prize
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-md">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg">Daftar Rumah</CardTitle>
              <CardDescription>Pilih kandidat spinwheel</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  onClick={handleExplicitSave}
                  className="w-full text-xs h-9"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Kandidat
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSelectAllOccupied}
                    className="w-full text-xs h-9"
                    disabled={housesLoading || membersLoading}
                  >
                    Pilih Semua Berpenghuni
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRestartSession}
                    className="w-full text-xs h-9 text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restart Sesi
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleClear}
                  className="w-full text-xs h-9 text-destructive"
                >
                  Hapus Semua
                </Button>
              </div>
              <Input
                placeholder="Cari blok/nomor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
              <div className="h-[400px] overflow-y-auto pr-2 space-y-1">
                {housesLoading ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  filteredHouses.map((h) => {
                    const isSelected = candidates.some((c) => c.id === h.id);
                    const isExcluded = excludedIds.has(h.id);
                    return (
                      <label
                        key={h.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer border border-transparent hover:border-border/50"
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={spinning || isExcluded}
                          onCheckedChange={() => handleToggleHouse(h)}
                        />
                        <span
                          className={`text-sm font-medium ${isExcluded ? "line-through text-muted-foreground" : ""}`}
                        >
                          Blok {h.block} No {h.number}
                        </span>
                        {isExcluded && (
                          <Badge
                            variant="secondary"
                            className="ml-auto text-[10px]"
                          >
                            Sudah
                          </Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[500px]">
              {candidates.length === 0 ? (
                <div className="text-center text-muted-foreground flex flex-col items-center gap-3">
                  <Gift className="w-16 h-16 opacity-20" />
                  <p>Belum ada rumah yang dipilih</p>
                </div>
              ) : n === 0 ? (
                <div className="text-center text-muted-foreground flex flex-col items-center gap-3">
                  <CheckCircle2 className="w-16 h-16 text-green-500/50" />
                  <p>Semua kandidat sudah mendapatkan door prize!</p>
                  <Button
                    variant="outline"
                    onClick={handleRestartSession}
                    className="mt-2"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restart Sesi
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-8 w-full">
                  <div className="flex justify-between w-full">
                    <Badge
                      variant="outline"
                      className="text-sm px-3 py-1 bg-background"
                    >
                      Total Kandidat: {n}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-sm px-3 py-1 bg-background text-primary"
                    >
                      Sudah Dapat: {excludedIds.size}
                    </Badge>
                  </div>

                  <div
                    className="relative"
                    style={{ width: SIZE, height: SIZE }}
                  >
                    <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10">
                      <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-foreground drop-shadow-md" />
                    </div>

                    <svg
                      width={SIZE}
                      height={SIZE}
                      viewBox={`0 0 ${SIZE} ${SIZE}`}
                      className="rounded-full border-[6px] border-foreground shadow-2xl bg-muted"
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
                            fontSize={24}
                            fontWeight={800}
                          >
                            {pool[0].block}.{pool[0].number}
                          </text>
                        </>
                      ) : (
                        pool.map((h, i) => {
                          const start = i * sliceAngle;
                          const end = (i + 1) * sliceAngle;
                          const mid = start + sliceAngle / 2;
                          const labelPos = polar(mid, R * 0.65);
                          return (
                            <g key={h.id}>
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
                                fontSize={n > 20 ? 12 : n > 10 ? 14 : 18}
                                fontWeight={800}
                                transform={`rotate(${mid}, ${labelPos.x}, ${labelPos.y})`}
                                style={{ pointerEvents: "none" }}
                              >
                                {h.block}.{h.number}
                              </text>
                            </g>
                          );
                        })
                      )}
                    </svg>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-foreground border-4 border-background z-10 shadow-inner" />
                  </div>

                  {winner && !spinning && (
                    <div className="w-full max-w-sm p-6 rounded-2xl bg-gradient-to-b from-primary/20 to-primary/5 border border-primary/30 text-center animate-in zoom-in-95 shadow-xl">
                      <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">
                        🎉 Pemenang Door Prize 🎉
                      </p>
                      <div className="text-4xl font-black text-foreground mb-6">
                        Blok {winner.block} No {winner.number}
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={markWinner}
                          className="flex-1 bg-primary text-white font-bold h-11 shadow-md hover:bg-primary/90"
                        >
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          Tandai
                        </Button>
                        <Button
                          variant="outline"
                          onClick={markWinner}
                          className="flex-1 font-bold h-11 border-dashed"
                        >
                          <X className="w-5 h-5 mr-2" />
                          Lewati
                        </Button>
                      </div>
                    </div>
                  )}

                  {!winner && (
                    <Button
                      onClick={handleSpin}
                      disabled={spinning}
                      size="lg"
                      className="w-full max-w-sm h-14 text-lg font-black shadow-lg rounded-xl"
                    >
                      <RotateCw
                        className={`w-5 h-5 mr-2 ${spinning ? "animate-spin" : ""}`}
                      />
                      {spinning ? "Memutar Roda..." : "Putar Spin Wheel"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
