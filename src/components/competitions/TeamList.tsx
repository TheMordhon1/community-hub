import { useState } from "react";
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
import { Plus, Users, Trash2, Crown } from "lucide-react";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { useDeleteTeam } from "@/hooks/useCompetitions";

interface TeamListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
  onAddTeam: () => void;
}

export function TeamList({ competition, canManage, onAddTeam }: TeamListProps) {
  const [deletingTeam, setDeletingTeam] = useState<CompetitionTeamWithMembers | null>(null);
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

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
          <p className="text-muted-foreground">Belum ada tim terdaftar</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Tim
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <Button size="sm" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Tim
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team, index) => (
            <Card key={team.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {team.seed_number || index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold">{team.name}</h4>
                      {team.is_eliminated && (
                        <Badge variant="destructive" className="text-xs">
                          Tereliminasi
                        </Badge>
                      )}
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

                {/* Team Members */}
                {team.members && team.members.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase">Anggota</p>
                    <div className="space-y-1">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={member.profile?.avatar_url || ""} />
                            <AvatarFallback className="text-xs">
                              {member.profile?.full_name?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">
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

                {(!team.members || team.members.length === 0) && (
                  <p className="text-sm text-muted-foreground">Belum ada anggota</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
    </>
  );
}
