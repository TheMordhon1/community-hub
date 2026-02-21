import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CalendarIcon,
  MapPin,
  Users,
  Loader2,
  Check,
  Share2,
  Clock,
  Trophy,
  User,
  PartyPopper,
} from "lucide-react";
import type { Profile, EventType } from "@/types/database";
import { ShareDialog } from "@/components/ShareDialog";
import { formatEventTime, getValidDate, getInitials } from "@/lib/utils";
import { CompetitionList } from "@/components/competitions/CompetitionList";
import { useEventCompetitions } from "@/hooks/useCompetitions";

interface AttendeeWithProfile {
  id: string;
  user_id: string;
  status: string;
  profile?: Profile;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user, canManageContent, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isShareOpen, setIsShareOpen] = useState(false);

  const canManage = canManageContent() || isAdmin();
  const { data: competitions } = useEventCompetitions(id);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch author profile separately since there's no FK relationship
      let author = null;
      if (data.author_id) {
        const { data: authorData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.author_id)
          .maybeSingle();
        author = authorData;
      }

      return { ...data, author };
    },
    enabled: !!id,
  });

  const { data: attendees, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("id, user_id, status, created_at")
        .eq("event_id", id)
        .eq("status", "attending");

      if (error) throw error;

      // Fetch profiles separately since there's no FK relationship
      const userIds = data.map((item) => item.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url ")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        status: item.status,
        profile: profileMap.get(item.user_id),
      })) as AttendeeWithProfile[];
    },
    enabled: !!id,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (isAttending: boolean) => {
      if (isAttending) {
        const { error } = await supabase
          .from("event_rsvps")
          .delete()
          .eq("event_id", id)
          .eq("user_id", user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_rsvps").upsert(
          {
            event_id: id,
            user_id: user?.id,
            status: "attending",
          },
          {
            onConflict: "event_id,user_id",
          }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees", id] });
      queryClient.invalidateQueries({ queryKey: ["event-rsvps"] });
      toast({
        title: "Berhasil",
        description: isUserAttending
          ? "Anda telah membatalkan kehadiran"
          : "Anda akan menghadiri acara ini",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Terjadi kesalahan",
      });
    },
  });

  const isUserAttending = attendees?.some((a) => a.user_id === user?.id);
  const isPastEvent = event ? new Date(event.event_date) < new Date() : false;
  const isCompetitionEvent = event?.event_type === "competition";
  const hasCompetitions = competitions && competitions.length > 0;

  const shareText = `${event?.title}\n\n${event?.description || ""}\n\n 
  📅 ${
    event?.event_date ? getValidDate(event.event_date, event.event_time) : ""
  }\n
  📍 ${event?.location || "Lokasi belum ditentukan"}`;
  const shareUrl = `${window.location.origin}/events/${id}`;

  if (isLoading) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Acara Tidak Ditemukan
              </h3>
              <Button asChild className="mt-4">
                <Link to="/events">Kembali ke Acara</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-background">
      {/* Hero Image Section */}
      {event.image_url && (
        <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden">
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          
          {/* Floating back button */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <Link
              to="/events"
              className="flex items-center gap-2 px-3 py-2 bg-background/80 backdrop-blur rounded-lg text-sm hover:bg-background transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
            <Button
              variant="outline"
              size="icon"
              className="bg-background/80 backdrop-blur"
              onClick={() => setIsShareOpen(true)}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="px-6 py-6 space-y-6">
        {/* Header without image */}
        {!event.image_url && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Link to="/events">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-display text-xl md:text-2xl font-bold">
                Detail Acara
              </h1>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsShareOpen(true)}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </motion.div>
        )}

        {/* Event Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={event.image_url ? "-mt-20 relative z-10" : ""}
        >
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isCompetitionEvent ? (
                      <Badge className="gap-1 bg-amber-500 hover:bg-amber-600">
                        <Trophy className="w-3 h-3" />
                        Kompetisi
                      </Badge>
                    ) : <></>}
                    {isPastEvent && <Badge variant="secondary">Selesai</Badge>}
                    {isCompetitionEvent && hasCompetitions && (
                      <Badge variant="outline" className="gap-1">
                        {competitions.length} Kompetisi
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {event.title}
                  </h1>
                </div>

                {!isPastEvent && (
                  <Button
                    size="lg"
                    variant={isUserAttending ? "default" : "outline"}
                    onClick={() => rsvpMutation.mutate(isUserAttending || false)}
                    disabled={rsvpMutation.isPending}
                    className="shrink-0"
                  >
                    {rsvpMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {isUserAttending ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Saya Akan Hadir
                      </>
                    ) : (
                      "Ikut Acara"
                    )}
                  </Button>
                )}
              </div>

              {/* Event Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span>
                    {format(new Date(event.event_date), "EEEE, dd MMMM yyyy", {
                      locale: idLocale,
                    })}
                  </span>
                </div>
                {event.event_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    <span>{formatEventTime(event.event_time)} WIB</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{attendees?.length || 0} peserta</span>
                </div>
              </div>
            </CardHeader>

            {(event.description || event.author) && (
              <CardContent className="space-y-6">
                <Separator />

                {event.description && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-muted-foreground">
                      Deskripsi
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                )}

                {event.author && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Avatar>
                      <AvatarImage src={event.author.avatar_url || ""} />
                      <AvatarFallback>
                        {getInitials(event.author.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs text-muted-foreground">Dibuat oleh</p>
                      <p className="font-medium">{event.author.full_name}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </motion.div>

        {/* Competitions Section - Only for competition events */}
        {isCompetitionEvent && (hasCompetitions || canManage) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Kompetisi
                </CardTitle>
                <CardDescription>
                  Daftar kompetisi dalam acara ini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompetitionList eventId={id!} canManage={canManage} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Attendees List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Peserta ({attendees?.length || 0})
              </CardTitle>
              <CardDescription>
                Warga yang akan menghadiri acara ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAttendees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : attendees && attendees.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <Avatar>
                        <AvatarImage src={attendee.profile?.avatar_url || ""} />
                        <AvatarFallback>
                          {getInitials(attendee.profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-1">
                          {attendee.profile?.full_name || "Unknown"}
                        </p>
                        {attendee.profile?.phone && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {attendee.profile.phone}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Hadir
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-3">
                    <Users className="w-8 h-8 opacity-50" />
                  </div>
                  <p>Belum ada warga terdaftar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title={event?.title || "Acara"}
        description="Ajak warga lain untuk menghadiri acara ini"
        url={shareUrl}
        shareText={shareText}
      />
    </section>
  );
}
