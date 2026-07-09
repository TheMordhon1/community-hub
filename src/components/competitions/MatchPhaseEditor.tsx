import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GitBranch } from "lucide-react";

interface MatchLike {
  id: string;
  competition_id: string;
  round_number?: number | null;
  phase_label?: string | null;
}

interface MatchPhaseEditorProps<T extends MatchLike> {
  match: T;
  allMatches: T[];
  onUpdate: (round: number, phase: string | null) => void;
  iconClassName?: string;
}

export function MatchPhaseEditor<T extends MatchLike>({
  match,
  allMatches,
  onUpdate,
  iconClassName = "w-3 h-3",
}: MatchPhaseEditorProps<T>) {
  const [tempRound, setTempRound] = useState(match.round_number || 1);
  const [tempPhase, setTempPhase] = useState(match.phase_label || "");

  // Find unique non-empty phase labels in the competition
  const existingPhases = useMemo(() => {
    return Array.from(
      new Set(
        allMatches
          .filter((m) => m.competition_id === match.competition_id && m.phase_label)
          .map((m) => m.phase_label!)
      )
    ).sort();
  }, [allMatches, match.competition_id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 group-hover/header:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-primary shrink-0 ml-1"
          title="Pengaturan Babak & Fase"
        >
          <GitBranch className={iconClassName} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="center" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-xs font-bold mb-3">Pengaturan Babak & Fase</h4>
        
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Nomor Babak (Kolom)</Label>
            <Input
              type="number"
              min={1}
              value={tempRound}
              onChange={(e) => setTempRound(parseInt(e.target.value, 10) || 1)}
              className="h-8 text-xs"
            />
          </div>
          
          <div>
            <Label className="text-[10px] font-semibold text-muted-foreground mb-1 block">Nama Fase</Label>
            <Input
              type="text"
              placeholder="Contoh: Semifinal, Juara 3"
              value={tempPhase}
              onChange={(e) => setTempPhase(e.target.value)}
              className="h-8 text-xs mb-1.5"
            />
            {existingPhases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                {existingPhases.map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setTempPhase(phase)}
                    className="text-[9px] bg-muted hover:bg-primary hover:text-primary-foreground px-1.5 py-0.5 rounded border transition-colors"
                  >
                    {phase}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <Button
            size="sm"
            className="w-full h-8 text-xs mt-1"
            onClick={() => {
              onUpdate(tempRound, tempPhase.trim() || null);
            }}
          >
            Simpan Perubahan
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
