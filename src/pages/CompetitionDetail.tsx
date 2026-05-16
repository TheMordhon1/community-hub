import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  useCompetitionDetails,
  useGenerateBracket,
  useGenerate17an,
  useUpdateCompetition,
  useDeleteCompetition,
  useAdvance17anRound,
  useResetAllMatches,
} from "@/hooks/useCompetitions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  Edit2,
  MoreVertical,
  RotateCcw,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { CreateCompetitionDialog } from "@/components/competitions/CreateCompetitionDialog";
import { CreateMatchDialog } from "@/components/competitions/CreateMatchDialog";
import { ShareDialog } from "@/components/ShareDialog";
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

export default function CompetitionDetail() {
  const { id: eventId, competitionId } = useParams();
  const navigate = useNavigate();
  const { user, canManageContent, isAdmin } = useAuth();

  const { data: competition, isLoading } = useCompetitionDetails(competitionId);
  const generateBracket = useGenerateBracket();
  const generate17an = useGenerate17an();
  const updateCompetition = useUpdateCompetition();
  const deleteCompetition = useDeleteCompetition();
  const advanceRound = useAdvance17anRound();
  const resetAllMatches = useResetAllMatches();

  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("matches");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGenerate17anOpen, setIsGenerate17anOpen] = useState(false);
  const [isAdvanceRoundDialogOpen, setIsAdvanceRoundDialogOpen] = useState(false);
  const [isResetAllOpen, setIsResetAllOpen] = useState(false);
  const [customPhaseLabel, setCustomPhaseLabel] = useState("");
  const [teamsPerMatch, setTeamsPerMatch] = useState(2);

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

  const handleGenerate17an = () => {
    if (!competition?.teams || competition.teams.length < 1) return;
    generate17an.mutate({
      competition_id: competition.id,
      teams: competition.teams,
      teams_per_match: teamsPerMatch,
      phase_label: customPhaseLabel || "Babak 1",
    }, {
      onSuccess: () => {
        setIsGenerate17anOpen(false);
        setCustomPhaseLabel("");
      }
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

  const handleDelete = () => {
    if (!competition) return;
    deleteCompetition.mutate(
      { id: competition.id, event_id: competition.event_id },
      {
        onSuccess: () => {
          navigate(eventId ? `/events/${eventId}` : "/events?tab=competitions");
        },
      }
    );
  };

  const handleAdvanceRound = () => {
    if (!competition) return;
    advanceRound.mutate({ 
      competition_id: competition.id,
      phase_label: customPhaseLabel || undefined
    }, {
      onSuccess: () => {
        setIsAdvanceRoundDialogOpen(false);
        setCustomPhaseLabel("");
      }
    });
  };

  const handleResetAllMatches = () => {
    if (!competition) return;
    resetAllMatches.mutate({ competition_id: competition.id }, {
      onSuccess: () => setIsResetAllOpen(false)
    });
  };

  const shareUrl = `${window.location.origin}${eventId ? `/events/${eventId}` : ""}/competitions/${competitionId}`;
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
                <Link to={eventId ? `/events/${eventId}` : "/events?tab=competitions"}>
                  {eventId ? "Kembali ke Acara" : "Kembali ke Daftar Kompetisi"}
                </Link>
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
        return (
          <span className="relative flex h-2 w-2 mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
        );
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
                to={eventId ? `/events/${eventId}` : "/events?tab=competitions"}
                className="flex items-center gap-2 "
              >
                 <ArrowLeft className="w-5 h-5" />
                <h1 className="font-display text-xl md:text-2xl font-bold">
                  {eventId ? "Kembali ke Acara" : "Kembali ke Daftar Kompetisi"}
                </h1>
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
                  {competition.status === "completed" && (
                    <Button
                      variant="outline"
                      onClick={() => handleStatusChange("ongoing")}
                      disabled={updateCompetition.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Lanjutkan Kompetisi
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditOpen(true)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                <p className="font-semibold">
                  {competition.match_type === "custom" && competition.custom_match_label
                    ? competition.custom_match_label
                    : MATCH_TYPE_LABELS[competition.match_type]}
                </p>
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
              <div className="flex justify-end items-center gap-2">
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 px-3 gap-2">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {competition.format === "17an" && competition.teams && competition.teams.length >= 1 && (
                        <DropdownMenuItem onClick={() => setIsGenerate17anOpen(true)} disabled={generate17an.isPending}>
                          <RefreshCw className={`w-4 h-4 mr-2 ${generate17an.isPending ? 'animate-spin' : ''}`} />
                          Bagi Grup/Lawan
                        </DropdownMenuItem>
                      )}
                      
                      {competition.format === "17an" && competition.matches && competition.matches.length > 0 && (
                        <DropdownMenuItem onClick={() => setIsAdvanceRoundDialogOpen(true)} disabled={advanceRound.isPending}>
                          <Trophy className="w-4 h-4 mr-2" />
                          Lanjutkan Babak
                        </DropdownMenuItem>
                      )}

                      {competition.format === "knockout" && competition.teams && competition.teams.length >= 2 && (
                        <DropdownMenuItem onClick={handleGenerateBracket} disabled={generateBracket.isPending}>
                          <RefreshCw className={`w-4 h-4 mr-2 ${generateBracket.isPending ? 'animate-spin' : ''}`} />
                          Generate Bracket
                        </DropdownMenuItem>
                      )}

                      {canModifyMatches && (
                        <DropdownMenuItem onClick={() => setIsCreateMatchOpen(true)}>
                          <Swords className="w-4 h-4 mr-2" />
                          Tambah Pertandingan
                        </DropdownMenuItem>
                      )}

                      {competition.matches && competition.matches.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setIsResetAllOpen(true)}
                            disabled={resetAllMatches.isPending}
                            className="text-destructive focus:text-destructive focus:bg-destructive/5"
                          >
                            <RotateCcw className={`w-4 h-4 mr-2 ${resetAllMatches.isPending ? 'animate-spin' : ''}`} />
                            Reset Semua Pertandingan
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Primary Action Shortcut (if needed) */}
                {canManage && competition.format === "17an" && competition.matches && competition.matches.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsAdvanceRoundDialogOpen(true)}
                    disabled={advanceRound.isPending}
                    className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-9"
                  >
                    {advanceRound.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trophy className="w-4 h-4 mr-2" />
                    )}
                    Lanjutkan Babak
                  </Button>
                )}
              </div>
              <MatchList competition={competition} canManage={canModifyMatches} />
            </TabsContent>

            <TabsContent value="teams" className="space-y-4">
              <TeamList
                competition={competition}
                canManage={canManage}
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

      <CreateMatchDialog
        open={isCreateMatchOpen}
        onOpenChange={setIsCreateMatchOpen}
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

      <CreateCompetitionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        eventId={eventId}
        editingCompetition={competition}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kompetisi?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Semua data pertandingan dan
              skor dalam kompetisi ini akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCompetition.isPending}
            >
              {deleteCompetition.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isAdvanceRoundDialogOpen} onOpenChange={setIsAdvanceRoundDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lanjutkan ke Babak Berikutnya</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh tim yang ditandai sebagai "Lolos" akan dikelompokkan ke dalam satu pertandingan baru di babak berikutnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="phase-label">Nama Babak / Fase (Opsional)</Label>
            <Input
              id="phase-label"
              placeholder="Contoh: Semi Final, Final, atau Babak 2"
              value={customPhaseLabel}
              onChange={(e) => setCustomPhaseLabel(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAdvanceRound}
              disabled={advanceRound.isPending}
            >
              {advanceRound.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Lanjutkan Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isGenerate17anOpen} onOpenChange={setIsGenerate17anOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bagi Grup/Lawan</AlertDialogTitle>
            <AlertDialogDescription>
              Tentukan berapa banyak peserta dalam satu sesi pertandingan/lomba.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gen-phase-label">Nama Babak (Contoh: Penyisihan, Babak 1)</Label>
              <Input
                id="gen-phase-label"
                placeholder="Babak 1"
                value={customPhaseLabel}
                onChange={(e) => setCustomPhaseLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teams-per-match">Jumlah Peserta per Sesi</Label>
              <Input
                id="teams-per-match"
                type="number"
                min="1"
                value={teamsPerMatch}
                onChange={(e) => setTeamsPerMatch(parseInt(e.target.value) || 1)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sistem akan mengacak peserta dan membaginya ke dalam grup-grup.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate17an}
              disabled={generate17an.isPending}
            >
              {generate17an.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Bagi Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isResetAllOpen} onOpenChange={setIsResetAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Seluruh Pertandingan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus SEMUA skor dan data pemenang dari seluruh pertandingan dalam kompetisi ini. 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllMatches}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetAllMatches.isPending}
            >
              {resetAllMatches.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Ya, Reset Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
