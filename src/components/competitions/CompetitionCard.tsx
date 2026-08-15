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
import { Trophy, Users, Settings, Trash2, Eye, Target, Swords } from "lucide-react";
import { Link } from "react-router-dom";
import type { EventCompetition } from "@/types/competition";
import {
  FORMAT_LABELS,
  MATCH_TYPE_LABELS,
  PARTICIPANT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/types/competition";
import { AGE_CATEGORY_LABELS, GENDER_CATEGORY_LABELS, formatBracket, type AgeBracket, type AgeCategory, type GenderCategory } from "@/lib/age-groups";
import { useDeleteCompetition } from "@/hooks/useCompetitions";

interface CompetitionCardProps {
  competition: EventCompetition;
  canManage: boolean;
  onEdit?: () => void;
  showEventName?: string;
}

export function CompetitionCard({
  competition,
  canManage,
  onEdit,
  showEventName,
}: CompetitionCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteCompetition();
  const ageBrackets: AgeBracket[] = Array.isArray(competition.kids_brackets)
    ? (competition.kids_brackets as AgeBracket[])
    : [];

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
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
                  {competition.sport_name}
                </CardTitle>

                {showEventName && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {showEventName}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={getStatusVariant(competition.status)}
              className={`shrink-0 ${competition.status === 'ongoing' ? 'pl-5 relative' : ''}`}
            >
              {competition.status === 'ongoing' && (
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
              )}
              {STATUS_LABELS[competition.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="w-4 h-4 shrink-0" />
              <span className="line-clamp-1">{FORMAT_LABELS[competition.format]}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Swords className="w-4 h-4 shrink-0" />
              <span className="line-clamp-1">{MATCH_TYPE_LABELS[competition.match_type]}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Users className="w-4 h-4 shrink-0" />
              <span className="line-clamp-1">
                {PARTICIPANT_TYPE_LABELS[competition.participant_type]}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {AGE_CATEGORY_LABELS[(competition.age_category as AgeCategory) || "mixed"]}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {GENDER_CATEGORY_LABELS[((competition as unknown as { gender_category?: GenderCategory }).gender_category) || "mixed"]}
            </Badge>
            {competition.max_participants && (
              <Badge variant="outline" className="text-[10px]">
                Maks. {competition.max_participants}
              </Badge>
            )}
          </div>

          {ageBrackets.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-dashed p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Grup Umur
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ageBrackets.map((b, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                    {formatBracket(b)}
                  </Badge>
                ))}
              </div>
            </div>
          )}


          {/* Actions */}
          <div className="flex gap-2 pt-2 mt-auto">
            <Button asChild variant="default" size="sm" className="flex-1">
              <Link
                to={
                  competition.event_id
                    ? `/events/${competition.event_id}/competitions/${competition.id}`
                    : `/competitions/${competition.id}`
                }
              >
                <Eye className="w-4 h-4 mr-1" />
                Lihat Detail
              </Link>
            </Button>

            {canManage && (
              <>
                <Button variant="outline" size="icon" onClick={onEdit}>
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
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
              Apakah Anda yakin ingin menghapus kompetisi "
              {competition.sport_name}"? Semua tim dan pertandingan akan ikut
              terhapus.
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
