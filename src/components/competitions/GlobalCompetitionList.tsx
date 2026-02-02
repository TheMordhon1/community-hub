import { useState, useMemo } from "react";
import { Trophy, Loader2, Plus, Filter } from "lucide-react";
import { useAllCompetitions } from "@/hooks/useCompetitions";
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
import { CreateCompetitionDialog } from "./CreateCompetitionDialog";
import { STATUS_LABELS, CompetitionStatus } from "@/types/competition";

interface GlobalCompetitionListProps {
  canManage?: boolean;
}

type StatusFilter = "all" | CompetitionStatus;

export function GlobalCompetitionList({ canManage }: GlobalCompetitionListProps) {
  const { data: competitions, isLoading } = useAllCompetitions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredCompetitions = useMemo(() => {
    if (!competitions) return [];
    if (statusFilter === "all") return competitions;
    return competitions.filter((c) => c.status === statusFilter);
  }, [competitions, statusFilter]);

  const statusCounts = useMemo(() => {
    if (!competitions) return { all: 0, registration: 0, ongoing: 0, completed: 0, cancelled: 0 };
    return {
      all: competitions.length,
      registration: competitions.filter((c) => c.status === "registration").length,
      ongoing: competitions.filter((c) => c.status === "ongoing").length,
      completed: competitions.filter((c) => c.status === "completed").length,
      cancelled: competitions.filter((c) => c.status === "cancelled").length,
    };
  }, [competitions]);

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
              {filteredCompetitions.length} kompetisi
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
                  <Badge variant="secondary" className="ml-1">
                    {statusCounts.all}
                  </Badge>
                </div>
              </SelectItem>
              <SelectItem value="registration">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.registration}
                  <Badge variant="default" className="ml-1">
                    {statusCounts.registration}
                  </Badge>
                </div>
              </SelectItem>
              <SelectItem value="ongoing">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.ongoing}
                  <Badge variant="secondary" className="ml-1">
                    {statusCounts.ongoing}
                  </Badge>
                </div>
              </SelectItem>
              <SelectItem value="completed">
                <div className="flex items-center gap-2">
                  {STATUS_LABELS.completed}
                  <Badge variant="outline" className="ml-1">
                    {statusCounts.completed}
                  </Badge>
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

      {/* Competition Grid */}
      {filteredCompetitions.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCompetitions.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              canManage={false}
              showEventName={competition.events?.title}
            />
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
