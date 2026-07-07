import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers, CompetitionMatchWithTeams } from "@/types/competition";
import { computeStandings, GROUP_LETTERS } from "@/lib/liga-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users } from "lucide-react";
import { parseMemberName, capitalizeName } from "@/lib/utils";
import { extractFlagAndName, getTeamFlag } from "@/lib/countries";
import { EditTeamDialog } from "./EditTeamDialog";
import { useUpdateCompetition } from "@/hooks/useCompetitions";

interface Props {
  competition: EventCompetitionWithDetails;
  canManage?: boolean;
}

type MemberWithHouse = {
  id: string;
  name?: string | null;
  profile?: {
    full_name: string | null;
    house?: { block: string; number: string };
  };
};



// Unified click+hover popover for team member list
function TeamNameWithMembers({
  team,
}: {
  team: {
    id: string;
    name: string;
    members?: MemberWithHouse[];
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          {team.name}
          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[160px] p-3"
        side="top"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="text-xs font-semibold mb-2 text-foreground">Anggota Tim:</div>
        <ul className="space-y-1.5">
          {team.members?.map((m) => {
            const parsed = parseMemberName(m.name);
            const name = capitalizeName(m.profile?.full_name?.trim() || parsed.name || "Peserta");
            const house = m.profile?.house;
            return (
              <li key={m.id} className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>{name}</span>
                {house && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded font-mono">
                    {house.block}.{house.number}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}




const formatMatchDateTime = (dateTimeStr: string | null | undefined) => {
  if (!dateTimeStr) return "Waktu belum ditentukan";
  try {
    const dt = new Date(dateTimeStr);
    return dt.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return dateTimeStr;
  }
};

interface MatchOutcomeCircleProps {
  outcome: "W" | "L" | "D" | "E";
  match: CompetitionMatchWithTeams | null;
  currentTeamId: string;
  allTeams: CompetitionTeamWithMembers[];
}

function MatchOutcomeCircle({ outcome, match, currentTeamId, allTeams }: MatchOutcomeCircleProps) {
  const [open, setOpen] = useState(false);
  
  if (outcome === "E" && !match) {
    return (
      <div className="w-5 h-5 rounded-full border border-muted-foreground/30 bg-transparent shrink-0" />
    );
  }

  // Find opponent
  const opponentId = match.team1_id === currentTeamId ? match.team2_id : match.team1_id;
  const opponent = allTeams.find(t => t.id === opponentId);
  const opponentName = opponent ? opponent.name : "Tim Lain";
  const { name: opponentCleanName } = extractFlagAndName(opponentName);

  let title = "";
  let badgeClass = "";
  let icon = "";

  if (outcome === "W") {
    title = `Menang vs ${opponentCleanName}`;
    badgeClass = "bg-emerald-500 text-white";
    icon = "✓";
  } else if (outcome === "L") {
    title = `Kalah vs ${opponentCleanName}`;
    badgeClass = "bg-rose-500 text-white";
    icon = "✗";
  } else if (outcome === "D") {
    title = `Seri vs ${opponentCleanName}`;
    badgeClass = "bg-amber-500 text-white";
    icon = "−";
  } else {
    // Outcome is "E", but we have a match object. That means it is a future scheduled match.
    title = `Akan Datang vs ${opponentCleanName}`;
    badgeClass = "bg-muted text-muted-foreground hover:bg-muted/80 border border-muted-foreground/25";
    icon = "";
  }

  const dateTimeFormatted = formatMatchDateTime(match.match_datetime);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 cursor-pointer transition-all hover:scale-110 focus:outline-none ${badgeClass}`}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3 z-50 text-xs shadow-md border bg-popover text-popover-foreground"
        side="top"
        align="center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-1">
          <div className="font-semibold text-foreground">{title}</div>
          {match.status === "completed" && (
            <div className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded inline-block">
              Skor: {match.score1} - {match.score2}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground pt-1 border-t">
            {dateTimeFormatted}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function GroupStandings({ competition, canManage = false }: Props) {
  const teams = competition.teams || [];
  const matches = competition.matches || [];
  const advance = competition.advance_per_group ?? 2;
  const [showFlags, setShowFlags] = useState(true);
  const [editingTeam, setEditingTeam] = useState<CompetitionTeamWithMembers | null>(null);

  const updateCompetition = useUpdateCompetition();

  const handleSetGroupAdvance = (groupName: string, count: number) => {
    const currentSettings = { ...(competition.kids_brackets as unknown as Record<string, number> || {}) };
    currentSettings[groupName] = count;

    updateCompetition.mutate({
      id: competition.id,
      event_id: competition.event_id,
      kids_brackets: currentSettings as unknown as { min: number; max: number; label?: string }[],
    });
  };

  const groups = Array.from(
    new Set(teams.map((t) => t.group_name).filter((g): g is string => !!g))
  ).sort();

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Belum ada peserta yang diassign ke grup. Buka tab Peserta untuk membagi ke Grup{" "}
          {GROUP_LETTERS.slice(0, competition.group_count ?? 3).join(", ")}.
        </CardContent>
      </Card>
    );
  }

  const gridColsClass = 
    groups.length === 1 
      ? "grid-cols-1" 
      : groups.length === 2 
        ? "grid-cols-1 md:grid-cols-2" 
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <>
      <div className="flex justify-end mb-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-muted/70 transition-colors">
          <input
            type="checkbox"
            checked={showFlags}
            onChange={(e) => setShowFlags(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
          />
          Tampilkan Bendera Tim
        </label>
      </div>
      <div className={`grid gap-4 w-full min-w-0 ${gridColsClass}`}>
        {groups.map((g) => {
          const rows = computeStandings(teams, matches, g);
          const groupTeamsCount = teams.filter((t) => t.group_name === g).length;
          const maxGroupMatches = Math.max(1, groupTeamsCount - 1);
          const groupAdvanceCount = (competition.kids_brackets as unknown as Record<string, number> | null)?.[g] ?? competition.advance_per_group ?? 2;

          return (
            <Card key={g} className="w-full min-w-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Grup {g}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px] font-bold text-foreground">Grup {g}</TableHead>
                        <TableHead className="text-center w-8 px-1" title="Main">
                          G
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Menang">
                          W
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Kalah">
                          L
                        </TableHead>
                        <TableHead className="text-center w-12 px-1 font-bold">Poin</TableHead>
                        <TableHead className="text-center w-28 px-1 whitespace-nowrap">{maxGroupMatches} Game</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => {
                        const advancing = idx < groupAdvanceCount;
                        const { flag, name: cleanName } = extractFlagAndName(r.team.name);
                        const teamFlagEmoji = getTeamFlag(r.team);

                        const memberNames = r.team.members?.map((m) => {
                          const parsed = parseMemberName(m.name);
                          return capitalizeName(parsed.name || m.profile?.full_name?.trim() || "Pemain");
                        }) || [];
                        const hasMembers = memberNames.length > 0;

                        // All matches for this team in this group stage, completed or scheduled
                        const teamGroupMatches = matches.filter((m) => {
                          return m.stage === "group" &&
                                 m.group_name === g &&
                                 (m.team1_id === r.team.id || m.team2_id === r.team.id);
                        });

                        const sortedTeamGroupMatches = [...teamGroupMatches].sort((a, b) => {
                          if (!a.match_datetime) return 1;
                          if (!b.match_datetime) return -1;
                          return new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime();
                        });

                        // Create exactly maxGroupMatches slots corresponding to W/L/D outcomes or scheduled match details
                        const historySlots = Array.from({ length: maxGroupMatches }, (_, i) => {
                          const match = sortedTeamGroupMatches[i] || null;
                          let outcome: "W" | "L" | "D" | "E" = "E";
                          if (match && match.status === "completed") {
                            const isTeam1 = match.team1_id === r.team.id;
                            const s1 = parseInt(match.score1 || "0", 10);
                            const s2 = parseInt(match.score2 || "0", 10);
                            if (s1 === s2) outcome = "D";
                            else if (isTeam1) {
                              outcome = s1 > s2 ? "W" : "L";
                            } else {
                              outcome = s2 > s1 ? "W" : "L";
                            }
                          }
                          return { outcome, match };
                        });

                        return (
                          <TableRow key={r.team.id} className={advancing ? "bg-primary/5" : ""}>
                            <TableCell className="font-medium py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-4 flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                {showFlags && (
                                  <span className="text-xl leading-none select-none shrink-0 animate-fade-in" title="Bendera Tim">
                                    {teamFlagEmoji}
                                  </span>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {canManage ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditingTeam(r.team)}
                                        className="hover:underline hover:text-primary font-bold cursor-pointer text-left transition-colors truncate max-w-[140px] sm:max-w-[180px]"
                                      >
                                        {cleanName}
                                      </button>
                                    ) : (
                                      <span className="truncate max-w-[140px] sm:max-w-[180px]" title={cleanName}>
                                        {cleanName}
                                      </span>
                                    )}
                                    {advancing && (
                                      <Medal className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                    )}
                                  </div>
                                  {hasMembers && (
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                      {memberNames.map((name, mIdx) => (
                                        <span 
                                          key={mIdx}
                                          className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px] sm:max-w-[180px]"
                                          title={name}
                                        >
                                          {name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center px-1 py-3">{r.played}</TableCell>
                            <TableCell className="text-center px-1 py-3">{r.wins}</TableCell>
                            <TableCell className="text-center px-1 py-3">{r.losses}</TableCell>
                            <TableCell className="text-center px-1 py-3 font-bold">
                              {r.points}
                            </TableCell>
                            <TableCell className="px-1 py-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {historySlots.map((slot, oIdx) => (
                                  <MatchOutcomeCircle
                                    key={oIdx}
                                    outcome={slot.outcome}
                                    match={slot.match}
                                    currentTeamId={r.team.id}
                                    allTeams={teams}
                                  />
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border-t">
                  <p className="text-[10px] text-muted-foreground">
                    Menang set = 1 poin, Top {groupAdvanceCount} tim lolos ke babak gugur.
                  </p>
                  {canManage && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                      <span>Lolos ke babak gugur:</span>
                      <select
                        value={groupAdvanceCount}
                        onChange={(e) => handleSetGroupAdvance(g, parseInt(e.target.value))}
                        className="bg-background border rounded px-1.5 py-0.5 font-semibold text-foreground focus:ring-1 focus:ring-primary text-[10px] outline-none"
                      >
                        {Array.from({ length: Math.max(1, groupTeamsCount) }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>{num} Tim</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingTeam && (
        <EditTeamDialog
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          team={editingTeam}
          competition={competition}
        />
      )}
    </>
  );
}
