import React from "react";
import { Round } from "./types";
import { MatchCard } from "./MatchCard";
import { Badge } from "@/components/ui/badge";

interface RoundColumnProps {
  round: Round;
  competitionId: string;
  totalRounds: number;
}

export function RoundColumn({ round, competitionId, totalRounds }: RoundColumnProps) {
  const r = round.id - 1;
  const cardHeight = 110; // Standard MatchCard height
  const baseGap = 24;
  const paddingTop = (cardHeight + baseGap) * (Math.pow(2, r) - 1) / 2;
  const gap = (cardHeight + baseGap) * Math.pow(2, r) - cardHeight;

  return (
    <div
      id={`round-column-${competitionId}-${round.id}`}
      className="flex flex-col w-[280px] sm:w-[320px] shrink-0 snap-center first:pl-2 last:pr-2 relative z-10"
      style={{
        paddingTop: `${paddingTop}px`,
        paddingBottom: `${paddingTop}px`,
        gap: `${gap}px`,
      }}
    >
      {/* Round Header */}
      <div className="bg-muted/80 backdrop-blur p-2.5 rounded-xl border text-center font-bold text-xs tracking-wide shadow-sm flex items-center justify-between px-3 h-10 shrink-0 select-none">
        <span className="truncate">{round.title}</span>
        <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0">
          {round.matches.length}
        </Badge>
      </div>

      {/* Column Matches Container */}
      <div className="flex flex-col gap-6 relative">
        {round.matches.map((match) => (
          <div key={match.id} className="relative shrink-0">
            <MatchCard match={match} />
          </div>
        ))}
      </div>
    </div>
  );
}
