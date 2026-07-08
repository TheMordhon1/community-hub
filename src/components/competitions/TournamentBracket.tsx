import React, { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BracketMatch {
  id: string;
  next_match_id?: string | null;
  round_number?: number | null;
  match_number?: number | null;
  match_datetime?: string | null;
  phase_label?: string | null;
  status: string;
  winner_id?: string | null;
}

interface TournamentBracketProps<T extends BracketMatch> {
  competitionId: string;
  matches: T[];
  canManage?: boolean;
  renderMatchCard: (match: T) => React.ReactNode;
  onUpdatePhaseLabel?: (roundMatches: T[], newLabel: string) => void;
  createPhaseNode?: React.ReactNode;
}

export function TournamentBracket<T extends BracketMatch>({
  competitionId,
  matches,
  canManage = false,
  renderMatchCard,
  onUpdatePhaseLabel,
  createPhaseNode,
}: TournamentBracketProps<T>) {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const [connections, setConnections] = useState<{ id: string; path: string; isWinner: boolean }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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
        if (!a.match_datetime && b.match_datetime) return 1;
        if (a.match_datetime && !b.match_datetime) return -1;
        if (!a.match_datetime && !b.match_datetime) return 0;
        return new Date(b.match_datetime).getTime() - new Date(a.match_datetime).getTime();
      });
    });

    return grouped;
  }, [matches]);

  const sortedRoundEntries = useMemo(() => {
    return Object.entries(matchesByRound).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [matchesByRound]);

  const totalRounds = sortedRoundEntries.length;

  const getRoundName = (roundNum: number, total: number, roundMatches: T[]) => {
    if (roundMatches[0]?.phase_label) return roundMatches[0].phase_label;
    if (roundNum === total && total > 1) return "Final";
    if (roundNum === total - 1 && total > 2) return "Semifinal";
    if (roundNum === total - 2 && total > 3) return "Perempat Final";
    return `Babak ${roundNum}`;
  };

  const updateConnections = () => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newConnections: { id: string; path: string; isWinner: boolean }[] = [];

    matches.forEach((match) => {
      if (!match.next_match_id) return;

      const sourceEl = container.querySelector(`#match-card-${match.id}`) as HTMLElement;
      const targetEl = container.querySelector(`#match-card-${match.next_match_id}`) as HTMLElement;

      if (sourceEl && targetEl) {
        const sourceRect = sourceEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const x1 = sourceRect.right - containerRect.left;
        const y1 = sourceRect.top - containerRect.top + sourceRect.height / 2;

        const x2 = targetRect.left - containerRect.left;
        const y2 = targetRect.top - containerRect.top + targetRect.height / 2;

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
  }, [matches, totalRounds]);

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
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Belum ada bagan pertandingan terbentuk.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation Header for Rounds */}
      <div className="flex items-center justify-between gap-4 bg-muted/30 border backdrop-blur p-2 rounded-xl">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handlePrevRound}
          disabled={currentRoundIdx === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-2 select-none">
          {sortedRoundEntries.map(([round, roundMatches], idx) => (
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
              {getRoundName(Number(round), totalRounds, roundMatches)}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleNextRound}
          disabled={currentRoundIdx === totalRounds - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Viewport container */}
      <div 
        ref={containerRef}
        className="overflow-x-auto pb-6 scrollbar-thin scroll-smooth snap-x snap-mandatory relative w-full border rounded-2xl bg-muted/5 p-4 sm:p-6"
        onScroll={handleScroll}
      >
        <div className="relative flex gap-12 min-w-max pr-12">
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
          {sortedRoundEntries.map(([round, roundMatches]) => {
            const r = Number(round) - 1;
            const cardHeight = 150;
            const baseGap = 24;
            const paddingTop = (cardHeight + baseGap) * (Math.pow(2, r) - 1) / 2;
            const gap = (cardHeight + baseGap) * Math.pow(2, r) - cardHeight;

            return (
              <div
                id={`round-column-${competitionId}-${round}`}
                key={round}
                className="flex flex-col w-[280px] sm:w-[320px] shrink-0 snap-center first:pl-2 last:pr-2 relative z-10"
                style={{
                  paddingTop: `${paddingTop}px`,
                  paddingBottom: `${paddingTop}px`,
                  gap: `${gap}px`,
                }}
              >
                {/* Round Title Header (Inside column) */}
                <div className="bg-muted/80 backdrop-blur p-2.5 rounded-xl border text-center font-bold text-xs tracking-wide shadow-sm flex items-center justify-between px-3 h-10 shrink-0 select-none">
                  <span className="truncate">{getRoundName(Number(round), totalRounds, roundMatches)}</span>
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
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-6 relative">
                  {roundMatches.map((match) => (
                    <div 
                      key={match.id} 
                      id={`match-card-${match.id}`}
                      className="relative shrink-0"
                    >
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
    </div>
  );
}
