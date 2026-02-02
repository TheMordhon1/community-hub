import { useState } from "react";
import { Trophy, Loader2, Calendar, Plus } from "lucide-react";
import { useAllCompetitions } from "@/hooks/useCompetitions";
import { CompetitionCard } from "./CompetitionCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateCompetitionDialog } from "./CreateCompetitionDialog";

interface GlobalCompetitionListProps {
  canManage?: boolean;
}

export function GlobalCompetitionList({ canManage }: GlobalCompetitionListProps) {
  const { data: competitions, isLoading } = useAllCompetitions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-6 h-6 text-primary" />
          Semua Kompetisi
        </h2>
        {canManage && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Kompetisi
          </Button>
        )}
      </div>

      {competitions && competitions.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((competition) => (
            <div key={competition.id} className="space-y-2">
              <CompetitionCard
                competition={competition}
                canManage={false}
              />
              {competition.events && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                  <Calendar className="w-3 h-3" />
                  <span>Bagian dari: {competition.events.title}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">Belum ada kompetisi</h3>
            <p className="text-muted-foreground max-w-sm">
              Belum ada kompetisi yang tersedia saat ini. Silakan hubungi pengurus untuk informasi lebih lanjut.
            </p>
            {canManage && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Kompetisi
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateCompetitionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
