import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { useRemoveReferee } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails } from "@/types/competition";
import { getInitials } from "@/lib/utils";
import { AssignRefereeDialog } from "./AssignRefereeDialog";

interface RefereeListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
}

export function RefereeList({ competition, canManage }: RefereeListProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const removeReferee = useRemoveReferee();

  const referees = competition.referees || [];

  const handleRemove = (id: string) => {
    removeReferee.mutate({ id, competition_id: competition.id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Wasit Pertandingan</CardTitle>
          <p className="text-sm text-muted-foreground">
            User yang ditugaskan sebagai wasit dapat memperbarui skor pertandingan.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Tambah Wasit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {referees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mb-2 opacity-50" />
            <p>Belum ada wasit yang ditugaskan</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {referees.map((referee) => {
              const displayName =
                referee.profile?.full_name ||
                referee.manual_name ||
                "Tanpa Nama";
              const isManual = !referee.user_id;
              return (
                <div
                  key={referee.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={referee.profile?.avatar_url || ""} />
                      <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{displayName}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldCheck className="w-3 h-3 text-primary" />
                        {isManual ? "Wasit (Manual)" : "Wasit"}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemove(referee.id)}
                      disabled={removeReferee.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AssignRefereeDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        competition={competition}
      />
    </Card>
  );
}
