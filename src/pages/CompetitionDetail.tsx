import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useCompetitionDetails, useGenerateBracket, useUpdateCompetition } from "@/hooks/useCompetitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Trophy,
  Users,
  Swords,
  Settings,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react";
import {
  FORMAT_LABELS,
  MATCH_TYPE_LABELS,
  PARTICIPANT_TYPE_LABELS,
  STATUS_LABELS,
  CompetitionStatus,
} from "@/types/competition";
import { TeamList } from "@/components/competitions/TeamList";
import { MatchList } from "@/components/competitions/MatchList";
import { AddTeamDialog } from "@/components/competitions/AddTeamDialog";

export default function CompetitionDetail() {
  const { id: eventId, competitionId } = useParams();
  const navigate = useNavigate();
  const { user, canManageContent, isAdmin } = useAuth();
  
  const { data: competition, isLoading } = useCompetitionDetails(competitionId);
  const generateBracket = useGenerateBracket();
  const updateCompetition = useUpdateCompetition();
  
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("teams");

  // Check if user can manage this competition
  const canManage = canManageContent() || isAdmin();

  const handleGenerateBracket = () => {
    if (!competition?.teams || competition.teams.length < 2) return;
    generateBracket.mutate({
      competition_id: competition.id,
      teams: competition.teams,
    });
  };

  const handleStatusChange = (status: CompetitionStatus) => {
    if (!competition) return;
    updateCompetition.mutate({
      id: competition.id,
      event_id: competition.event_id,
      status,
    });
  };

  if (isLoading) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (!competition) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Kompetisi Tidak Ditemukan
              </h3>
              <Button asChild className="mt-4">
                <Link to={`/events/${eventId}`}>Kembali ke Acara</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

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
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-2">
            <Link to={`/events/${eventId}`}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-display text-xl md:text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              {competition.sport_name}
            </h1>
            <Badge variant={getStatusVariant(competition.status)}>
              {STATUS_LABELS[competition.status]}
            </Badge>
          </div>

          {canManage && (
            <div className="flex gap-2">
              {competition.status === "registration" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange("ongoing")}
                  disabled={updateCompetition.isPending}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Mulai Kompetisi
                </Button>
              )}
              {competition.status === "ongoing" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange("completed")}
                  disabled={updateCompetition.isPending}
                >
                  Selesaikan
                </Button>
              )}
            </div>
          )}
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detail Kompetisi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Format</p>
                  <p className="font-medium">{FORMAT_LABELS[competition.format]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipe</p>
                  <p className="font-medium">{MATCH_TYPE_LABELS[competition.match_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peserta</p>
                  <p className="font-medium">{PARTICIPANT_TYPE_LABELS[competition.participant_type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tim Terdaftar</p>
                  <p className="font-medium">{competition.teams?.length || 0}</p>
                </div>
              </div>

              {competition.rules && (
                <div>
                  <p className="text-muted-foreground text-sm mb-1">Peraturan</p>
                  <p className="text-sm whitespace-pre-wrap">{competition.rules}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Tim ({competition.teams?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="matches" className="flex items-center gap-2">
                <Swords className="w-4 h-4" />
                Pertandingan ({competition.matches?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-4">
              <TeamList
                competition={competition}
                canManage={canManage && competition.status === "registration"}
                onAddTeam={() => setIsAddTeamOpen(true)}
              />
            </TabsContent>

            <TabsContent value="matches" className="mt-4 space-y-4">
              {canManage && competition.format === "knockout" && competition.teams && competition.teams.length >= 2 && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateBracket}
                    disabled={generateBracket.isPending}
                  >
                    {generateBracket.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Generate Bracket
                  </Button>
                </div>
              )}
              <MatchList
                competition={competition}
                canManage={canManage}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Add Team Dialog */}
      <AddTeamDialog
        open={isAddTeamOpen}
        onOpenChange={setIsAddTeamOpen}
        competition={competition}
      />
    </section>
  );
}
