import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Match } from "./types";
import { Calendar, Clock, Trophy } from "lucide-react";

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const isTeam1Winner = match.status === "finished" && match.winnerId === match.team1?.id;
  const isTeam2Winner = match.status === "finished" && match.winnerId === match.team2?.id;

  const renderTeam = (team: Match["team1"], isWinner: boolean, score?: number) => {
    if (!team) {
      return (
        <div className="flex items-center justify-between py-1.5 opacity-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">?</div>
            <span className="text-sm font-medium">TBD</span>
          </div>
          <span className="text-sm font-bold">-</span>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex items-center justify-between py-1.5 transition-colors rounded px-1.5",
        isWinner ? "bg-primary/5 text-primary" : ""
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {team.logo ? (
            <img src={team.logo} alt={team.name} className="w-6 h-6 rounded-full object-cover border" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {team.name.slice(0, 2)}
            </div>
          )}
          <span className={cn(
            "text-sm font-semibold truncate",
            isWinner ? "font-bold" : "text-foreground/80"
          )}>
            {team.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isWinner && <Trophy className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />}
          <span className={cn(
            "text-sm font-mono font-bold w-4 text-right",
            isWinner ? "text-primary" : "text-muted-foreground"
          )}>
            {score !== undefined ? score : "-"}
          </span>
        </div>
      </div>
    );
  };

  const getStatusBadge = () => {
    switch (match.status) {
      case "live":
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[9px] uppercase tracking-wider h-5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            Live
          </Badge>
        );
      case "finished":
        return (
          <Badge variant="secondary" className="font-semibold text-[9px] uppercase tracking-wider h-5">
            Selesai
          </Badge>
        );
      case "upcoming":
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground font-semibold text-[9px] uppercase tracking-wider h-5">
            Mendatang
          </Badge>
        );
    }
  };

  return (
    <Card 
      id={`match-card-${match.id}`}
      className={cn(
        "w-full transition-all duration-300 hover:shadow-md hover:border-primary/40 dark:hover:border-primary/30 border-border/80 bg-card/60 backdrop-blur-sm select-none",
        match.status === "live" ? "ring-1 ring-red-500/30 border-red-500/40" : ""
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Card Header Info */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-1.5 border-border/40">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{match.date}</span>
            {match.time && (
              <>
                <Clock className="w-3 h-3 ml-1" />
                <span>{match.time}</span>
              </>
            )}
          </div>
          {getStatusBadge()}
        </div>

        {/* Teams List */}
        <div className="space-y-1">
          {renderTeam(match.team1, isTeam1Winner, match.score1)}
          {renderTeam(match.team2, isTeam2Winner, match.score2)}
        </div>
      </CardContent>
    </Card>
  );
}
