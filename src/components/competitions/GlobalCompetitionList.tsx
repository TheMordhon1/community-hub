import { useState, useMemo } from "react";
import { Trophy, Loader2, Plus, Filter, Calendar, FileText } from "lucide-react";
import { useAllCompetitions } from "@/hooks/useCompetitions";
import { useAuth } from "@/hooks/useAuth";
import { CompetitionCard } from "./CompetitionCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { CreateCompetitionDialog } from "./CreateCompetitionDialog";
import { STATUS_LABELS, CompetitionStatus } from "@/types/competition";

interface GlobalCompetitionListProps {
  canManage?: boolean;
}

type StatusFilter = "all" | CompetitionStatus;

export function GlobalCompetitionList({ canManage }: GlobalCompetitionListProps) {
  const { data: competitions, isLoading } = useAllCompetitions();
  const { canManageContent } = useAuth();
  const canSeeDrafts = canManageContent();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Hide competitions whose parent event is draft from users who can't manage
  const visibleCompetitions = useMemo(() => {
    if (!competitions) return [];
    if (canSeeDrafts) return competitions;
    return competitions.filter((c) => !c.events || c.events.status !== "draft");
  }, [competitions, canSeeDrafts]);

  const filteredCompetitions = useMemo(() => {
    if (statusFilter === "all") return visibleCompetitions;
    return visibleCompetitions.filter((c) => c.status === statusFilter);
  }, [visibleCompetitions, statusFilter]);

  const statusCounts = useMemo(() => {
    return {
      all: visibleCompetitions.length,
      registration: visibleCompetitions.filter((c) => c.status === "registration").length,
      ongoing: visibleCompetitions.filter((c) => c.status === "ongoing").length,
      completed: visibleCompetitions.filter((c) => c.status === "completed").length,
      cancelled: visibleCompetitions.filter((c) => c.status === "cancelled").length,
    };
  }, [visibleCompetitions]);

  // Group by parent event
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        eventId: string | null;
        eventTitle: string;
        eventStatus: string | null;
        competitions: typeof filteredCompetitions;
      }
    >();
    filteredCompetitions.forEach((c) => {
      const key = c.event_id ?? "__standalone__";
      if (!map.has(key)) {
        map.set(key, {
          key,
          eventId: c.event_id,
          eventTitle: c.events?.title ?? "Kompetisi Mandiri",
          eventStatus: c.events?.status ?? null,
          competitions: [],
        });
      }
      map.get(key)!.competitions.push(c);
    });
    return Array.from(map.values());
  }, [filteredCompetitions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Daftar Kompetisi</h2>
            <p className="text-sm text-muted-foreground">
              {filteredCompetitions.length} kompetisi dalam {grouped.length} acara
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  Semua
                  <Badge variant="secondary" className="ml-1">{statusCounts.all}</Badge>
                </div>
              </SelectItem>
              <SelectItem value="registration">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.registration}
                  <Badge variant="default" className="ml-1">{statusCounts.registration}</Badge>
                </div>
              </SelectItem>
              <SelectItem value="ongoing">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.ongoing}
                  <Badge variant="secondary" className="ml-1">{statusCounts.ongoing}</Badge>
                </div>
              </SelectItem>
              <SelectItem value="completed">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.completed}
                  <Badge variant="outline" className="ml-1">{statusCounts.completed}</Badge>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {canManage && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Tambah Kompetisi</span>
            </Button>
          )}
        </div>
      </div>

      {/* Grouped competitions by event */}
      {grouped.length > 0 ? (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {group.eventId ? (
                    <Calendar className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  {group.eventId ? (
                    <Link
                      to={`/events/${group.eventId}`}
                      className="font-semibold text-base hover:underline truncate"
                    >
                      {group.eventTitle}
                    </Link>
                  ) : (
                    <span className="font-semibold text-base truncate">{group.eventTitle}</span>
                  )}
                  {group.eventStatus === "draft" && (
                    <Badge variant="outline" className="shrink-0">Draft</Badge>
                  )}
                  <Badge variant="secondary" className="shrink-0">
                    {group.competitions.length}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {group.competitions.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                    canManage={false}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Trophy className="w-12 h-12 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {statusFilter === "all"
                ? "Belum ada kompetisi"
                : `Tidak ada kompetisi ${STATUS_LABELS[statusFilter as CompetitionStatus].toLowerCase()}`}
            </h3>
            <p className="text-muted-foreground max-w-sm mb-4">
              {statusFilter === "all"
                ? "Belum ada kompetisi yang tersedia saat ini."
                : "Tidak ada kompetisi dengan status tersebut."}
            </p>
            {canManage && statusFilter === "all" && (
              <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
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
