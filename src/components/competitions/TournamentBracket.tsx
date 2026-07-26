import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Edit, GripVertical, ArrowUp, ArrowDown, ListOrdered, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface BracketMatch {
  id: string;
  next_match_id?: string | null;
  round_number?: number | null;
  match_number?: number | null;
  match_datetime?: string | null;
  phase_label?: string | null;
  status: string;
  winner_id?: string | null;
  stage?: string | null;
}

interface TournamentBracketProps<T extends BracketMatch> {
  competitionId: string;
  matches: T[];
  canManage?: boolean;
  renderMatchCard: (match: T) => React.ReactNode;
  onUpdatePhaseLabel?: (roundMatches: T[], newLabel: string) => void;
  createPhaseNode?: React.ReactNode;
  onResetKnockout?: () => void;
  onRegenerateKnockout?: () => void;
  onReorderPhases?: (updates: { id: string; round_number: number }[]) => void;
  onAddPhase?: (phaseLabel: string) => void;
  onDeleteMatch?: (matchId: string) => void;
  onDeletePhase?: (matchIds: string[]) => void;
  onAddMatch?: (roundNumber: number, phaseLabel: string) => void;
  competitionStages?: { name: string; order_number: number }[];
}

export function TournamentBracket<T extends BracketMatch>({
  competitionId,
  matches,
  canManage = false,
  renderMatchCard,
  onUpdatePhaseLabel,
  createPhaseNode,
  onResetKnockout,
  onRegenerateKnockout,
  onReorderPhases,
  onAddPhase,
  onDeleteMatch,
  onDeletePhase,
  onAddMatch,
  competitionStages,
}: TournamentBracketProps<T>) {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [connections, setConnections] = useState<{ id: string; path: string; isWinner: boolean }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem(`bracket-offsets-${competitionId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isDragging, setIsDragging] = useState<string | null>(null);

  const [connectionSides, setConnectionSides] = useState<Record<string, { sourceSide: 'left' | 'right'; targetSide: 'left' | 'right' }>>(() => {
    try {
      const saved = localStorage.getItem(`bracket-connections-${competitionId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(`bracket-connections-${competitionId}`, JSON.stringify(connectionSides));
  }, [connectionSides, competitionId]);

  const toggleSourceSide = (matchId: string) => {
    setConnectionSides((prev) => {
      const current = prev[matchId] || { sourceSide: 'right', targetSide: 'left' };
      return {
        ...prev,
        [matchId]: {
          ...current,
          sourceSide: current.sourceSide === 'left' ? 'right' : 'left',
        },
      };
    });
  };

  const toggleTargetSide = (matchId: string) => {
    setConnectionSides((prev) => {
      const current = prev[matchId] || { sourceSide: 'right', targetSide: 'left' };
      return {
        ...prev,
        [matchId]: {
          ...current,
          targetSide: current.targetSide === 'left' ? 'right' : 'left',
        },
      };
    });
  };

  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [localPhases, setLocalPhases] = useState<{ label: string; matchIds: string[]; active: boolean }[]>([]);
  const [newPhaseLabel, setNewPhaseLabel] = useState("");

  // Hidden phases persisted to localStorage
  const [hiddenPhaseLabels, setHiddenPhaseLabels] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`bracket-hidden-phases-${competitionId}`);
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const openReorderDialog = () => {
    const phasesMap = new Map<string, { label: string; currentRound: number; matchIds: string[] }>();
    matches.forEach((m) => {
      const label = m.phase_label || `Babak ${m.round_number || 1}`;
      if (!phasesMap.has(label)) {
        phasesMap.set(label, { label, currentRound: m.round_number || 1, matchIds: [] });
      }
      phasesMap.get(label)!.matchIds.push(m.id);
    });
    
    const sorted = Array.from(phasesMap.values())
      .sort((a, b) => a.currentRound - b.currentRound)
      .map(p => ({ label: p.label, matchIds: p.matchIds, active: !hiddenPhaseLabels.has(p.label) }));
      
    setLocalPhases(sorted);
    setIsReorderOpen(true);
  };

  const movePhase = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= localPhases.length) return;
    
    const updated = [...localPhases];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;
    
    setLocalPhases(updated);
  };

  const togglePhaseActive = (index: number) => {
    setLocalPhases(prev => prev.map((p, i) => i === index ? { ...p, active: !p.active } : p));
  };

  const handleSaveReorder = () => {
    if (!onReorderPhases) return;
    
    const updates: { id: string; round_number: number }[] = [];
    localPhases.forEach((phase, index) => {
      const newRound = index + 1;
      phase.matchIds.forEach((id) => {
        updates.push({ id, round_number: newRound });
      });
    });
    
    // Persist hidden/shown state to localStorage
    const hidden = new Set(localPhases.filter(p => !p.active).map(p => p.label));
    setHiddenPhaseLabels(hidden);
    localStorage.setItem(`bracket-hidden-phases-${competitionId}`, JSON.stringify(Array.from(hidden)));
    
    onReorderPhases(updates);
    setIsReorderOpen(false);
  };

  useEffect(() => {
    localStorage.setItem(`bracket-offsets-${competitionId}`, JSON.stringify(offsets));
  }, [offsets, competitionId]);

  const handleMouseDown = (e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    setIsDragging(matchId);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = offsets[matchId]?.x || 0;
    const initialY = offsets[matchId]?.y || 0;

    let minX = -Infinity;
    let maxX = Infinity;
    let minY = -Infinity;
    let maxY = Infinity;

    const cardEl = document.getElementById(`match-card-${matchId}`);
    const containerEl = innerRef.current;
    if (cardEl && containerEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const contRect = containerEl.getBoundingClientRect();
      
      const padding = 20; // Allow 20px padding
      minX = initialX - (cardRect.left - contRect.left) + padding;
      maxX = initialX + (contRect.right - cardRect.right) - padding;
      minY = initialY - (cardRect.top - contRect.top) + padding;
      maxY = initialY + (contRect.bottom - cardRect.bottom) - padding;
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = initialX + deltaX;
      let newY = initialY + deltaY;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));

      setOffsets((prev) => ({
        ...prev,
        [matchId]: {
          x: newX,
          y: newY,
        },
      }));
      
      requestAnimationFrame(updateConnections);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Group matches by round
  const matchesByRound = useMemo(() => {
    const grouped = matches.reduce((acc, m) => {
      const round = m.round_number || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(m);
      return acc;
    }, {} as Record<number, T[]>);

    // Sort matches in each round
    Object.keys(grouped).forEach((r) => {
      grouped[Number(r)].sort((a, b) => {
        if (a.match_datetime && b.match_datetime) {
          const diff = new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
          if (diff !== 0) return diff;
        } else if (a.match_datetime && !b.match_datetime) {
          return -1;
        } else if (!a.match_datetime && b.match_datetime) {
          return 1;
        }
        
        // Fallback to match_number for stable sorting
        const numA = a.match_number || 0;
        const numB = b.match_number || 0;
        if (numA !== numB) return numA - numB;
        
        // Final fallback to id
        return a.id.localeCompare(b.id);
      });
    });

    return grouped;
  }, [matches]);

  const sortedRoundEntries = useMemo(() => {
    return Object.entries(matchesByRound).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [matchesByRound]);

  const totalRounds = sortedRoundEntries.length;

  // Only show phases not hidden by manager
  const visibleRoundEntries = sortedRoundEntries.filter(([, roundMatches]) => {
    const label = roundMatches[0]?.phase_label || `Babak ${roundMatches[0]?.round_number || 1}`;
    return !hiddenPhaseLabels.has(label);
  });
  const visibleTotalRounds = visibleRoundEntries.length;

  const uniquePhases = useMemo(() => {
    const phasesMap = new Map<string, { label: string; currentRound: number; matchIds: string[] }>();
    matches.forEach((m) => {
      const label = m.phase_label || `Babak ${m.round_number || 1}`;
      if (!phasesMap.has(label)) {
        phasesMap.set(label, {
          label,
          currentRound: m.round_number || 1,
          matchIds: [],
        });
      }
      phasesMap.get(label)!.matchIds.push(m.id);
    });
    
    return Array.from(phasesMap.values()).sort((a, b) => a.currentRound - b.currentRound);
  }, [matches]);

  const getRoundName = (roundNum: number, total: number, roundMatches: T[]) => {
    if (roundMatches[0]?.phase_label) return roundMatches[0].phase_label;
    
    if (competitionStages && competitionStages.length > 0) {
      if (roundMatches[0]?.stage === "group") {
        const maxOrder = Math.max(...competitionStages.map(s => s.order_number));
        const groupStageName = competitionStages.find(s => s.order_number === maxOrder);
        if (groupStageName) return groupStageName.name;
      } else {
        const fromEnd = total - roundNum + 1;
        const stageMatch = competitionStages.find(s => s.order_number === fromEnd);
        if (stageMatch) return stageMatch.name;
      }
    }

    if (roundNum === total && total > 1) return "Final";
    if (roundNum === total - 1 && total > 2) return "Semifinal";
    if (roundNum === total - 2 && total > 3) return "Perempat Final";
    return `Babak ${roundNum}`;
  };

  const updateConnections = () => {
    const innerContainer = innerRef.current;
    if (!innerContainer) return;

    const innerRect = innerContainer.getBoundingClientRect();
    const newConnections: { id: string; path: string; isWinner: boolean }[] = [];

    matches.forEach((match) => {
      if (!match.next_match_id) return;

      const sourceEl = innerContainer.querySelector(`#match-card-${match.id}`) as HTMLElement;
      const targetEl = innerContainer.querySelector(`#match-card-${match.next_match_id}`) as HTMLElement;

      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const sSides = connectionSides[match.id] || { sourceSide: 'right', targetSide: 'left' };
        const tSides = connectionSides[match.next_match_id] || { sourceSide: 'right', targetSide: 'left' };

        let x1 = 0;
        if (sSides.sourceSide === 'left') {
          x1 = sourceRect.left - innerRect.left;
        } else {
          x1 = sourceRect.right - innerRect.left;
        }
        const y1 = sourceRect.top - innerRect.top + sourceRect.height / 2;

        let x2 = 0;
        if (tSides.targetSide === 'right') {
          x2 = targetRect.right - innerRect.left;
        } else {
          x2 = targetRect.left - innerRect.left;
        }
        const y2 = targetRect.top - innerRect.top + targetRect.height / 2;

        const x_mid = x1 + (x2 - x1) / 2;
        const path = `M ${x1} ${y1} H ${x_mid} V ${y2} H ${x2}`;

        const isWinner = match.status === "completed" && match.winner_id !== null;

        newConnections.push({
          id: `${match.id}-${match.next_match_id}`,
          path,
          isWinner,
        });
      }
    });

    setConnections(newConnections);
  };

  useEffect(() => {
    if (totalRounds === 0) return;

    const timer = setTimeout(() => {
      updateConnections();
    }, 400);

    window.addEventListener("resize", updateConnections);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateConnections);
    };
  }, [matches, totalRounds, connectionSides]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    const index = Math.round(scrollLeft / width);
    if (index >= 0 && index < totalRounds) {
      setCurrentRoundIdx(index);
    }
  };

  const handleGoToRound = (idx: number) => {
    const container = containerRef.current;
    if (!container || !sortedRoundEntries[idx]) return;

    const roundNum = sortedRoundEntries[idx][0];
    const column = container.querySelector(`#round-column-${competitionId}-${roundNum}`);
    if (column) {
      column.scrollIntoView({ behavior: "smooth", inline: "center" });
      setCurrentRoundIdx(idx);
      setTimeout(updateConnections, 350);
    }
  };

  const handlePrevRound = () => {
    if (currentRoundIdx > 0) {
      handleGoToRound(currentRoundIdx - 1);
    }
  };

  const handleNextRound = () => {
    if (currentRoundIdx < totalRounds - 1) {
      handleGoToRound(currentRoundIdx + 1);
    }
  };

  if (totalRounds === 0) {
    if (canManage && createPhaseNode) {
      return (
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-2xl p-6 bg-muted/5 flex justify-center">
          <div className="w-full max-w-sm">{createPhaseNode}</div>
        </div>
      );
    }
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Belum ada bagan pertandingan terbentuk.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation Header for Rounds */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 border backdrop-blur p-2 rounded-xl">
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handlePrevRound}
            disabled={currentRoundIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-2 select-none justify-center flex-1">
            {visibleRoundEntries.map(([round, roundMatches], idx) => (
              <button
                key={round}
                onClick={() => handleGoToRound(idx)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200",
                  currentRoundIdx === idx
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {getRoundName(Number(round), visibleTotalRounds, roundMatches)}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleNextRound}
            disabled={currentRoundIdx === visibleTotalRounds - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {(Object.keys(offsets).length > 0 || (canManage && (onResetKnockout || onRegenerateKnockout))) && (
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-muted/50">
            {Object.keys(offsets).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => {
                  setOffsets({});
                  setTimeout(updateConnections, 100);
                }}
              >
                Reset Tata Letak
              </Button>
            )}
            {canManage && onResetKnockout && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 px-3 text-[10px] font-bold transition-all"
                onClick={() => {
                  if (window.confirm("Apakah Anda yakin ingin menghapus/reset semua pertandingan Babak Gugur? Data babak grup akan tetap dipertahankan.")) {
                    onResetKnockout();
                  }
                }}
              >
                Reset Babak Gugur
              </Button>
            )}
            {canManage && onRegenerateKnockout && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[10px] font-bold transition-all hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                onClick={() => {
                  if (window.confirm("Apakah Anda yakin ingin men-generate ulang babak gugur? Semua skor babak gugur saat ini akan dihapus!")) {
                    onRegenerateKnockout();
                  }
                }}
              >
                Regenerate Babak Gugur
              </Button>
            )}
            {canManage && onReorderPhases && uniquePhases.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-[10px] font-bold transition-all flex items-center gap-1 hover:bg-primary hover:text-primary-foreground"
                onClick={openReorderDialog}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                Urutkan Fase
              </Button>
            )}

          </div>
        )}
      </div>

      {/* Viewport container */}
      <div 
        ref={containerRef}
        className="overflow-x-auto pb-32 pt-12 scrollbar-thin relative w-full border rounded-2xl bg-muted/5 px-4 sm:px-6"
        onScroll={handleScroll}
      >
        <div ref={innerRef} className="relative flex gap-12 min-w-max pr-12 pb-24">
          {/* SVG Connectors Canvas */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
            <g fill="none" strokeWidth={2}>
              {connections.map((c) => (
                <path
                  key={c.id}
                  d={c.path}
                  className={cn(
                    "transition-all duration-300",
                    c.isWinner 
                      ? "stroke-primary/80 dark:stroke-primary/60 drop-shadow-[0_0_3px_rgba(var(--primary),0.3)]" 
                      : "stroke-muted-foreground/30 dark:stroke-muted-foreground/20"
                  )}
                />
              ))}
            </g>
          </svg>

          {/* Columns */}
          {visibleRoundEntries.map(([round, roundMatches]) => {
            const r = Number(round) - 1;
            const cardHeight = 220;
            const baseGap = 32;
            const paddingTop = (cardHeight + baseGap) * (Math.pow(2, r) - 1) / 2;
            const gap = (cardHeight + baseGap) * Math.pow(2, r) - cardHeight;

            return (
              <div
                id={`round-column-${competitionId}-${round}`}
                key={round}
                className="flex flex-col w-[280px] sm:w-[320px] shrink-0 first:pl-2 last:pr-2 relative z-10 gap-4"
              >
                {/* Round Title Header (Inside column) */}
                <div className="bg-muted/80 backdrop-blur p-2.5 rounded-xl border text-center font-bold text-xs tracking-wide shadow-sm flex items-center justify-between px-3 h-10 shrink-0 select-none">
                  <span className="truncate">{getRoundName(Number(round), visibleTotalRounds, roundMatches)}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0">{roundMatches.length}</Badge>
                    {canManage && onUpdatePhaseLabel && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          const firstMatch = roundMatches[0];
                          const newLabel = window.prompt("Ubah Nama Babak/Fase:", firstMatch.phase_label || "");
                          if (newLabel !== null) {
                            onUpdatePhaseLabel(roundMatches, newLabel);
                          }
                        }}
                        title="Ubah Nama Fase"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {canManage && onAddMatch && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          const firstMatch = roundMatches[0];
                          onAddMatch(firstMatch.round_number || 1, firstMatch.phase_label || "");
                        }}
                        title="Tambah Pertandingan ke Fase Ini"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div 
                  className="flex flex-col relative"
                  style={{
                    paddingTop: `${paddingTop}px`,
                    paddingBottom: `${paddingTop}px`,
                    gap: `${gap}px`,
                  }}
                >
                  {roundMatches.map((match) => (
                    <div 
                      key={match.id} 
                      id={`match-card-${match.id}`}
                      className="relative shrink-0 group/card"
                      style={{
                        transform: `translate(${offsets[match.id]?.x || 0}px, ${offsets[match.id]?.y || 0}px)`,
                        cursor: isDragging === match.id ? 'grabbing' : 'default',
                        transition: isDragging === match.id ? 'none' : 'transform 0.15s ease-out',
                      }}
                    >
                      {/* Drag Handle */}
                      <div
                        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover/card:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 bg-background border rounded-md shadow-sm z-20"
                        onMouseDown={(e) => handleMouseDown(e, match.id)}
                      >
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      {canManage && (
                        <div className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 z-30 select-none px-1">
                          <button
                            type="button"
                            onClick={() => toggleTargetSide(match.id)}
                            className={cn(
                              "px-1.5 py-0.5 rounded border text-[9px] font-bold shadow-sm transition-all flex items-center gap-1",
                              ((connectionSides[match.id]?.targetSide || 'left') === 'left') 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-card text-muted-foreground border-border hover:bg-muted"
                            )}
                            title="Titik Masuk Garis (Garis Kiri/Kanan)"
                          >
                            Masuk: {(connectionSides[match.id]?.targetSide || 'left') === 'left' ? '← Kiri' : '→ Kanan'}
                          </button>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => toggleSourceSide(match.id)}
                              className={cn(
                                "px-1.5 py-0.5 rounded border text-[9px] font-bold shadow-sm transition-all flex items-center gap-1",
                                ((connectionSides[match.id]?.sourceSide || 'right') === 'left') 
                                  ? "bg-primary text-primary-foreground border-primary" 
                                  : "bg-card text-muted-foreground border-border hover:bg-muted"
                              )}
                              title="Titik Keluar Garis (Garis Kiri/Kanan)"
                            >
                              Keluar: {(connectionSides[match.id]?.sourceSide || 'right') === 'left' ? '← Kiri' : '→ Kanan'}
                            </button>
                            {onDeleteMatch && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Apakah Anda yakin ingin menghapus pertandingan ini?")) {
                                    onDeleteMatch(match.id);
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded border text-[9px] font-bold shadow-sm transition-all flex items-center gap-1 bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground"
                                title="Hapus Pertandingan"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {renderMatchCard(match)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {canManage && createPhaseNode && (
            <div className="flex flex-col w-[280px] sm:w-[320px] shrink-0 justify-center items-center h-[180px] border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors rounded-2xl p-6 self-center select-none bg-muted/5">
              {createPhaseNode}
            </div>
          )}
        </div>
      </div>

      {/* Dialog for Reordering Phases */}
      <Dialog open={isReorderOpen} onOpenChange={(open) => { setIsReorderOpen(open); if (!open) setNewPhaseLabel(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-primary" />
              Kelola Urutan Fase
            </DialogTitle>
            <DialogDescription>
              Ubah urutan, atau tambah fase baru langsung di sini.
            </DialogDescription>
          </DialogHeader>

          {/* Phase list */}
          <div className="mt-4 space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {localPhases.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">Belum ada fase. Tambahkan fase pertama di bawah.</p>
            )}
            {localPhases.map((phase, idx) => (
              <div
                key={phase.label}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors shadow-sm"
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-2">
                  <span className={cn("text-sm font-semibold truncate", !phase.active && "text-muted-foreground line-through")}>{phase.label}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {phase.matchIds.length} Pertandingan
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Active / Inactive toggle */}
                  <button
                    type="button"
                    onClick={() => togglePhaseActive(idx)}
                    className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full border transition-all",
                      phase.active
                        ? "bg-green-50 text-green-700 border-green-300 hover:bg-green-100 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                  >
                    {phase.active ? "Aktif" : "Nonaktif"}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    disabled={idx === 0}
                    onClick={() => movePhase(idx, "up")}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    disabled={idx === localPhases.length - 1}
                    onClick={() => movePhase(idx, "down")}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  {onDeletePhase && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (window.confirm(`Apakah Anda yakin ingin menghapus seluruh pertandingan di fase "${phase.label}"?`)) {
                          onDeletePhase(phase.matchIds);
                          setLocalPhases(prev => prev.filter((_, i) => i !== idx));
                        }
                      }}
                      title="Hapus Fase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new phase inline */}
          {onAddPhase && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2">
              <Input
                placeholder="Nama fase baru (misal: Perebutan Juara 3)"
                value={newPhaseLabel}
                onChange={(e) => setNewPhaseLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newPhaseLabel.trim()) {
                    const label = newPhaseLabel.trim();
                    onAddPhase(label);
                    setLocalPhases(prev => [...prev, { label, matchIds: [], active: true }]);
                    setNewPhaseLabel("");
                  }
                }}
                className="h-9 text-sm flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-3 shrink-0 flex items-center gap-1"
                disabled={!newPhaseLabel.trim()}
                onClick={() => {
                  if (newPhaseLabel.trim()) {
                    const label = newPhaseLabel.trim();
                    onAddPhase(label);
                    // Optimistically add to list immediately
                    setLocalPhases(prev => [...prev, { label, matchIds: [], active: true }]);
                    setNewPhaseLabel("");
                  }
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => { setIsReorderOpen(false); setNewPhaseLabel(""); }}>
              Batal
            </Button>
            <Button size="sm" onClick={handleSaveReorder} disabled={localPhases.length === 0}>
              Simpan Urutan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
