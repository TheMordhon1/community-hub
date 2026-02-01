import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trophy, Loader2 } from "lucide-react";
import { useEventCompetitions } from "@/hooks/useCompetitions";
import { CompetitionCard } from "./CompetitionCard";
import { CreateCompetitionDialog } from "./CreateCompetitionDialog";
import type { EventCompetition } from "@/types/competition";

interface CompetitionListProps {
  eventId: string;
  canManage: boolean;
}

export function CompetitionList({ eventId, canManage }: CompetitionListProps) {
  const { data: competitions, isLoading } = useEventCompetitions(eventId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCompetition, setEditingCompetition] = useState<EventCompetition | null>(null);

  const handleEdit = (competition: EventCompetition) => {
    setEditingCompetition(competition);
    setIsCreateOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setEditingCompetition(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Kompetisi ({competitions?.length || 0})
        </h3>
        {canManage && (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Tambah
          </Button>
        )}
      </div>

      {competitions && competitions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {competitions.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              canManage={canManage}
              onEdit={() => handleEdit(competition)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
            <p className="text-muted-foreground">Belum ada kompetisi</p>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah Kompetisi
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateCompetitionDialog
        open={isCreateOpen}
        onOpenChange={handleCloseDialog}
        eventId={eventId}
        editingCompetition={editingCompetition}
      />
    </div>
  );
}
