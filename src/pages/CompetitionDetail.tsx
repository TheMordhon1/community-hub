import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  useCompetitionDetails,
  useGenerateBracket,
  useUpdateCompetition,
} from "@/hooks/useCompetitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Trophy,
  Users,
  Swords,
  Loader2,
  Play,
  RefreshCw,
  CheckCircle,
  Calendar,
  Target,
  ShieldCheck,
  Share2,
} from "lucide-react";
import {
  FORMAT_LABELS,
  MATCH_TYPE_LABELS,
  PARTICIPANT_TYPE_LABELS,
  STATUS_LABELS,
  CompetitionStatus,
  CompetitionReferee,
} from "@/types/competition";
import { TeamList } from "@/components/competitions/TeamList";
import { MatchList } from "@/components/competitions/MatchList";
import { RefereeList } from "@/components/competitions/RefereeList";
import { AddTeamDialog } from "@/components/competitions/AddTeamDialog";
import { ShareDialog } from "@/components/ShareDialog";

export default function CompetitionDetail() {
  const { id: eventId, competitionId } = useParams();
  const navigate = useNavigate();
  const { user, canManageContent, isAdmin } = useAuth();

  const { data: competition, isLoading } = useCompetitionDetails(competitionId);
  const generateBracket = useGenerateBracket();
  const updateCompetition = useUpdateCompetition();

  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("matches");
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Check if user can manage this competition
  const isReferee = competition?.referees?.some(
    (ref: CompetitionReferee) => ref.user_id === user?.id
  );
  const canManage = canManageContent() || isAdmin();
  const canModifyMatches = canManage || isReferee;

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

  const shareUrl = `${window.location.origin}/events/${eventId}/competitions/${competitionId}`;
  const shareText = `${competition?.sport_name}\n\nFormat: ${competition ? FORMAT_LABELS[competition.format] : ""}\nTipe: ${competition ? MATCH_TYPE_LABELS[competition.match_type] : ""}`;

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "registration":
        return <Users className="w-4 h-4" />;
      case "ongoing":
        return <Play className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const completedMatches =
    competition.matches?.filter((m) => m.status === "completed").length || 0;
  const totalMatches = competition.matches?.length || 0;

  return (
    <section className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b">
        <div className="px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Link
                to={`/events/${eventId}`}
                className="flex items-center gap-2 "
              >
                 <ArrowLeft className="w-5 h-5" />
                <h1 className="font-display text-xl md:text-2xl font-bold">Kembali ke Acara</h1>
              </Link>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsShareOpen(true)}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Title and Status */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Trophy className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold">
                      {competition.sport_name}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      Kompetisi {PARTICIPANT_TYPE_LABELS[competition.participant_type]}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={getStatusVariant(competition.status)}
                  className="text-sm px-3 py-1"
                >
                  {getStatusIcon(competition.status)}
                  <span className="ml-1">{STATUS_LABELS[competition.status]}</span>
                </Badge>
              </div>

              {canManage && (
                <div className="flex gap-2">
                  {competition.status === "registration" && (
                    <Button
                      onClick={() => handleStatusChange("ongoing")}
                      disabled={updateCompetition.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Mulai Kompetisi
                    </Button>
                  )}
                  {competition.status === "ongoing" && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange("completed")}
                      disabled={updateCompetition.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Selesaikan
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/80 backdrop-blur rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="w-4 h-4" />
                  <span className="text-xs font-medium">Format</span>
                </div>
                <p className="font-semibold">{FORMAT_LABELS[competition.format]}</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Tipe</span>
                </div>
                <p className="font-semibold">{MATCH_TYPE_LABELS[competition.match_type]}</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Tim</span>
                </div>
                <p className="font-semibold">{competition.teams?.length || 0} Tim</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Swords className="w-4 h-4" />
                  <span className="text-xs font-medium">Pertandingan</span>
                </div>
                <p className="font-semibold">
                  {completedMatches}/{totalMatches} Selesai
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-6 py-6 space-y-6">
        {/* Rules Section (if exists) */}
        {competition.rules && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Peraturan Kompetisi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {competition.rules}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="matches" className="flex items-center gap-2">
                <Swords className="w-4 h-4" />
                <span className="hidden sm:inline">Pertandingan</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {competition.matches?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="teams" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Tim</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {competition.teams?.length || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="referees" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Wasit</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {competition.referees?.length || 0}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="space-y-4">
              {canManage &&
                competition.format === "knockout" &&
                competition.teams &&
                competition.teams.length >= 2 && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateBracket}
                      disabled={generateBracket.isPending}
                    >
                      {generateBracket.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Generate Bracket
                    </Button>
                  </div>
                )}
              <MatchList competition={competition} canManage={canModifyMatches} />
            </TabsContent>

            <TabsContent value="teams" className="space-y-4">
              <TeamList
                competition={competition}
                canManage={canManage && competition.status === "registration"}
                onAddTeam={() => setIsAddTeamOpen(true)}
              />
            </TabsContent>

            <TabsContent value="referees" className="space-y-4">
              <RefereeList competition={competition} canManage={canManage} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Dialogs */}
      <AddTeamDialog
        open={isAddTeamOpen}
        onOpenChange={setIsAddTeamOpen}
        competition={competition}
      />

      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title={competition?.sport_name || "Kompetisi"}
        description="Bagikan kompetisi ini"
        url={shareUrl}
        shareText={shareText}
      />
    </section>
  );
}
