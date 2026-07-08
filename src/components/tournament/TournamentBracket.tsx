import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Match } from "./types";
import { groupMatchesIntoRounds } from "./utils";
import { RoundColumn } from "./RoundColumn";
import { BracketConnector } from "./BracketConnector";

interface TournamentBracketProps {
  competitionId: string;
  matches: Match[];
}

export function TournamentBracket({ competitionId, matches }: TournamentBracketProps) {
  const [currentRoundIdx, setCurrentRoundIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rounds = groupMatchesIntoRounds(matches);
  const totalRounds = rounds.length;

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
    if (!container || !rounds[idx]) return;

    const roundId = rounds[idx].id;
    const column = container.querySelector(`#round-column-${competitionId}-${roundId}`);
    if (column) {
      column.scrollIntoView({ behavior: "smooth", inline: "center" });
      setCurrentRoundIdx(idx);
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
      <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed rounded-2xl">
        Belum ada bagan pertandingan terbentuk.
      </div>
    );
  }

  // Get all matches with nextMatchId to render connectors
  const connectorMatches = matches.filter((m) => m.nextMatchId);

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
          {rounds.map((round, idx) => (
            <button
              key={round.id}
              onClick={() => handleGoToRound(idx)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200",
                currentRoundIdx === idx
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {round.title}
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
            <g fill="none">
              {connectorMatches.map((match) => (
                <BracketConnector
                  key={`${match.id}-${match.nextMatchId}`}
                  sourceId={match.id}
                  targetId={match.nextMatchId!}
                  containerEl={containerRef.current}
                  isWinner={match.status === "finished" && !!match.winnerId}
                />
              ))}
            </g>
          </svg>

          {/* Columns */}
          {rounds.map((round) => (
            <RoundColumn
              key={round.id}
              round={round}
              competitionId={competitionId}
              totalRounds={totalRounds}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
