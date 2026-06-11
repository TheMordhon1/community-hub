import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Trash2, Crown, Sparkles } from "lucide-react";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { useDeleteTeam } from "@/hooks/useCompetitions";
import { getInitials } from "@/lib/utils";
import { getKidsBracket, AGE_GROUP_LABELS, type AgeCategory } from "@/lib/age-groups";
import { SpinWheelDialog } from "./SpinWheelDialog";

interface TeamListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
  onAddTeam: () => void;
}

export function TeamList({ competition, canManage, onAddTeam }: TeamListProps) {
  const [deletingTeam, setDeletingTeam] = useState<CompetitionTeamWithMembers | null>(null);
  const [isSpinOpen, setIsSpinOpen] = useState(false);
  const deleteTeamMutation = useDeleteTeam();

  const handleDeleteTeam = () => {
    if (!deletingTeam) return;
    deleteTeamMutation.mutate({
      id: deletingTeam.id,
      competition_id: competition.id,
    });
    setDeletingTeam(null);
  };

  const teams = competition.teams || [];
  const ageCategory = (competition.age_category as AgeCategory) || "mixed";

  // Group kids by auto-computed age bracket for fair grouping display.
  const groupedTeams = useMemo(() => {
    const groups = new Map<string, CompetitionTeamWithMembers[]>();
    for (const t of teams) {
      let key = "Lainnya";
      if (ageCategory === "kids" || (ageCategory === "mixed" && t.age_group === "kids")) {
        if (t.age != null) {
          key = `Anak-anak · ${getKidsBracket(Number(t.age))}`;
        } else {
          key = "Anak-anak · (umur belum diisi)";
        }
      } else if (t.age_group) {
        key = AGE_GROUP_LABELS[t.age_group as keyof typeof AGE_GROUP_LABELS] || "Lainnya";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [teams, ageCategory]);

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
          <p className="text-muted-foreground">Belum ada peserta terdaftar</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Peserta
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSpinOpen(true)}
            disabled={teams.length < 2}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Spin Wheel
          </Button>
          {canManage && (
            <Button size="sm" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Peserta
            </Button>
          )}
        </div>

        {groupedTeams.map(([groupLabel, groupTeams]) => (
          <div key={groupLabel} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {groupLabel}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {groupTeams.length}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {groupTeams.map((team, index) => (
                <Card key={team.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {team.seed_number || index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold">{team.name}</h4>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {team.house && (
                              <Badge variant="outline" className="text-xs">
                                Blok {team.house.block} No. {team.house.number}
                              </Badge>
                            )}
                            {team.age != null && (
                              <Badge variant="outline" className="text-xs">
                                {Number(team.age)} thn
                              </Badge>
                            )}
                            {team.age_group && (
                              <Badge variant="secondary" className="text-xs">
                                {AGE_GROUP_LABELS[team.age_group as keyof typeof AGE_GROUP_LABELS]}
                              </Badge>
                            )}
                            {team.is_eliminated && (
                              <Badge variant="destructive" className="text-xs">
                                Tereliminasi
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingTeam(team)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {team.members && team.members.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase">Anggota</p>
                        <div className="space-y-1">
                          {team.members.map((member) => (
                            <div key={member.id} className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={member.profile?.avatar_url || ""} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.profile?.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm line-clamp-1">
                                {member.profile?.full_name || "Unknown"}
                              </span>
                              {member.is_captain && (
                                <Crown className="w-3 h-3 text-yellow-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tim</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tim "{deletingTeam?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SpinWheelDialog
        open={isSpinOpen}
        onOpenChange={setIsSpinOpen}
        teams={teams}
      />
    </>
  );
}
