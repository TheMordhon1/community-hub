import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Copy, Trophy, Users, CheckSquare, Square } from "lucide-react";
import type {
  EventCompetitionWithDetails,
  CompetitionMatchWithTeams,
  CompetitionTeam,
} from "@/types/competition";
import { TeamFlag } from "@/components/competitions/TeamFlag";
import { extractFlagAndName } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface CopyMatchParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMatchId?: string;
  competition: EventCompetitionWithDetails;
  onCopySelectedTeams: (selectedTeams: CompetitionTeam[]) => void;
}

export function CopyMatchParticipantsDialog({
  open,
  onOpenChange,
  currentMatchId,
  competition,
  onCopySelectedTeams,
}: CopyMatchParticipantsDialogProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  // Filter out the current match so manager copies from OTHER matches
  const availableMatches = useMemo(() => {
    if (!competition.matches) return [];
    return competition.matches.filter((m) => m.id !== currentMatchId);
  }, [competition.matches, currentMatchId]);

  // Set default selected match when dialog opens
  useEffect(() => {
    if (open && availableMatches.length > 0 && !selectedMatchId) {
      setSelectedMatchId(availableMatches[0].id);
    }
  }, [open, availableMatches, selectedMatchId]);

  // Find currently selected match details
  const currentSelectedMatch = useMemo(() => {
    return availableMatches.find((m) => m.id === selectedMatchId) || null;
  }, [availableMatches, selectedMatchId]);

  // Extract all participant teams from the selected match
  const matchTeams = useMemo(() => {
    if (!currentSelectedMatch) return [];
    const teamsMap = new Map<string, { team: CompetitionTeam; rank?: number | null; isWinner?: boolean; score?: string | null }>();

    // 1. From participants table (used in 17an & multi-participant)
    if (currentSelectedMatch.participants && currentSelectedMatch.participants.length > 0) {
      currentSelectedMatch.participants.forEach((p) => {
        if (p.team) {
          teamsMap.set(p.team.id, {
            team: p.team,
            rank: p.winner_rank,
            isWinner: p.is_winner,
            score: p.score,
          });
        }
      });
    }

    // 2. From team1 and team2 (used in 1v1 / 2v2)
    if (currentSelectedMatch.team1) {
      if (!teamsMap.has(currentSelectedMatch.team1.id)) {
        teamsMap.set(currentSelectedMatch.team1.id, {
          team: currentSelectedMatch.team1,
          isWinner: currentSelectedMatch.winner_id === currentSelectedMatch.team1.id,
          score: currentSelectedMatch.score1,
        });
      }
    }

    if (currentSelectedMatch.team2) {
      if (!teamsMap.has(currentSelectedMatch.team2.id)) {
        teamsMap.set(currentSelectedMatch.team2.id, {
          team: currentSelectedMatch.team2,
          isWinner: currentSelectedMatch.winner_id === currentSelectedMatch.team2.id,
          score: currentSelectedMatch.score2,
        });
      }
    }

    return Array.from(teamsMap.values());
  }, [currentSelectedMatch]);

  // Auto-select all participant teams of the selected match when match changes
  useEffect(() => {
    if (matchTeams.length > 0) {
      setSelectedTeamIds(matchTeams.map((item) => item.team.id));
    } else {
      setSelectedTeamIds([]);
    }
  }, [matchTeams]);

  const toggleSelectTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  const isAllSelected = matchTeams.length > 0 && selectedTeamIds.length === matchTeams.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTeamIds([]);
    } else {
      setSelectedTeamIds(matchTeams.map((item) => item.team.id));
    }
  };

  const handleApply = () => {
    const chosenTeams = matchTeams
      .filter((item) => selectedTeamIds.includes(item.team.id))
      .map((item) => item.team);

    onCopySelectedTeams(chosenTeams);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            Salin Peserta dari Match Lain
          </DialogTitle>
          <DialogDescription>
            Pilih pertandingan asal dan beri tanda centang pada peserta yang ingin disalin ke match ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Match Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Pilih Match Asal (Sumber Peserta)
            </Label>
            {availableMatches.length === 0 ? (
              <div className="p-3 text-center border rounded-lg bg-muted/20 text-xs text-muted-foreground">
                Belum ada pertandingan lain yang tersedia dalam kompetisi ini.
              </div>
            ) : (
              <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Pertandingan..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableMatches.map((m) => {
                    const matchName = m.phase_label
                      ? `${m.phase_label} (Match #${m.match_number})`
                      : `Match #${m.match_number}`;
                    const count = m.participants?.length || (m.team1_id ? (m.team2_id ? 2 : 1) : 0);
                    return (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-2">
                          <span className="font-medium">{matchName}</span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {count} Peserta
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Participant List with Checkboxes */}
          {currentSelectedMatch && (
            <div className="space-y-2 border rounded-xl p-3 bg-muted/10">
              <div className="flex items-center justify-between border-b pb-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  Daftar Peserta Match
                </Label>
                {matchTeams.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-7 px-2 text-xs font-medium gap-1 text-primary hover:bg-primary/10"
                  >
                    {isAllSelected ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> Batal Pilih
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5" /> Pilih Semua
                      </>
                    )}
                  </Button>
                )}
              </div>

              {matchTeams.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Match asal yang dipilih belum memiliki data peserta.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {matchTeams.map(({ team, rank, isWinner, score }) => {
                    const isSelected = selectedTeamIds.includes(team.id);
                    return (
                      <div
                        key={team.id}
                        onClick={() => toggleSelectTeam(team.id)}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all duration-150",
                          isSelected
                            ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                            : "border-border bg-background hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectTeam(team.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <TeamFlag team={team} className="w-5 h-4 object-cover rounded shrink-0 border border-border/20" />
                          <span className="font-semibold truncate">{extractFlagAndName(team.name).name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {score && (
                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                              Skor: {score}
                            </span>
                          )}
                          {rank ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-0.5">
                              <Trophy className="w-3 h-3" /> Juara {rank}
                            </Badge>
                          ) : isWinner ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                              Pemenang
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedTeamIds.length === 0}
            className="gap-1.5"
          >
            <Copy className="w-4 h-4" />
            Salin ({selectedTeamIds.length}) Peserta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
