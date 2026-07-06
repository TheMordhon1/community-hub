import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Medal } from "lucide-react";
import type { EventCompetitionWithDetails } from "@/types/competition";
import { computeStandings, GROUP_LETTERS } from "@/lib/liga-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Users } from "lucide-react";
import { parseMemberName, capitalizeName } from "@/lib/utils";

interface Props {
  competition: EventCompetitionWithDetails;
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


export function GroupStandings({ competition }: Props) {
  const teams = competition.teams || [];
  const matches = competition.matches || [];
  const advance = competition.advance_per_group ?? 2;

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

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const rows = computeStandings(teams, matches, g);
          return (
            <Card key={g}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Grup {g}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead className="min-w-[120px]">Tim</TableHead>
                        <TableHead className="text-center w-8 px-1" title="Main">
                          M
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Menang">
                          W
                        </TableHead>
                        <TableHead className="text-center w-8 px-1" title="Kalah">
                          L
                        </TableHead>
                        <TableHead className="text-center w-10 px-1" title="Selisih Set">
                          ±
                        </TableHead>
                        <TableHead className="text-center w-10 px-1 font-bold">Poin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => {
                        const advancing = idx < advance;
                        return (
                          <TableRow key={r.team.id} className={advancing ? "bg-primary/5" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {idx + 1}
                                {advancing && (
                                  <Medal className="w-3 h-3 text-yellow-500 shrink-0" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {r.team.members && r.team.members.length > 0 ? (
                                <TeamNameWithMembers team={r.team} />
                              ) : (
                                r.team.name
                              )}
                            </TableCell>
                            <TableCell className="text-center px-1">{r.played}</TableCell>
                            <TableCell className="text-center px-1">{r.wins}</TableCell>
                            <TableCell className="text-center px-1">{r.losses}</TableCell>
                            <TableCell className="text-center px-1">
                              {r.diff > 0 ? `+${r.diff}` : r.diff}
                            </TableCell>
                            <TableCell className="text-center px-1 font-bold">
                              {r.points}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground p-3 border-t">
                  Menang match = 2 poin, Top {advance} tim lolos ke babak gugur.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
