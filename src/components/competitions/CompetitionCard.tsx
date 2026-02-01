import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Trophy, Users, Settings, Trash2, Play, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventCompetition } from "@/types/competition";
import {
  FORMAT_LABELS,
  MATCH_TYPE_LABELS,
  PARTICIPANT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/types/competition";
import { useDeleteCompetition } from "@/hooks/useCompetitions";

interface CompetitionCardProps {
  competition: EventCompetition;
  canManage: boolean;
  onEdit?: () => void;
}

export function CompetitionCard({ competition, canManage, onEdit }: CompetitionCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteCompetition();

  const handleDelete = () => {
    deleteMutation.mutate({
      id: competition.id,
      event_id: competition.event_id,
    });
    setShowDeleteConfirm(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "registration":
        return "default";
      case "ongoing":
        return "secondary";
      case "completed":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">{competition.sport_name}</CardTitle>
            </div>
            <Badge variant={getStatusVariant(competition.status)}>
              {STATUS_LABELS[competition.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {PARTICIPANT_TYPE_LABELS[competition.participant_type]}
            </span>
            <span>•</span>
            <span>{FORMAT_LABELS[competition.format]}</span>
            <span>•</span>
            <span>{MATCH_TYPE_LABELS[competition.match_type]}</span>
          </div>

          {competition.max_participants && (
            <p className="text-sm text-muted-foreground">
              Maks. {competition.max_participants} peserta
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to={`/events/${competition.event_id}/competitions/${competition.id}`}>
                <Eye className="w-4 h-4 mr-1" />
                Lihat
              </Link>
            </Button>
            
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kompetisi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus kompetisi "{competition.sport_name}"?
              Semua tim dan pertandingan akan ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
