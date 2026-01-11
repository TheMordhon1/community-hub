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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CalendarIcon,
  MapPin,
  Users,
  Loader2,
  Check,
  Share2,
} from "lucide-react";
import type { Event, Profile } from "@/types/database";
import { ShareDialog } from "@/components/ShareDialog";

interface AttendeeWithProfile {
  id: string;
  user_id: string;
  status: string;
  profile?: Profile;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isShareOpen, setIsShareOpen] = useState(false);

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
        .select("id, full_name, email, avatar_url")
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
            status: "going",
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

  const shareText = `📅 ${event?.title}\n\n${event?.description || ""}\n\n📅 ${
    event?.event_date
      ? format(new Date(event.event_date), "d MMMM yyyy, HH:mm", {
          locale: idLocale,
        })
      : ""
  }\n📍 ${event?.location || "Lokasi belum ditentukan"}`;
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
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <Button variant="ghost" size="icon" asChild>
            <Link to="/events">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsShareOpen(true)}
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Event Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            {event.image_url && (
              <div className="w-full h-64 overflow-hidden rounded-t-lg">
                <img
                  src={event.image_url || "/placeholder.svg"}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  {isPastEvent && <Badge variant="secondary">Selesai</Badge>}
                  <CardTitle className="text-3xl">{event.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-base">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {format(new Date(event.event_date), "d MMMM yyyy", {
                        locale: idLocale,
                      })}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Lokasi</p>
                    <p className="text-muted-foreground">{event.location}</p>
                  </div>
                </div>
              )}

              {event.description && (
                <div className="space-y-2">
                  <p className="font-medium">Deskripsi</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {event.description}
                  </p>
                </div>
              )}

              {event.author && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                  <Avatar>
                    <AvatarImage src={event.author.avatar_url || ""} />
                    <AvatarFallback>
                      {event.author.full_name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-muted-foreground">Dibuat oleh</p>
                    <p className="font-medium">{event.author.full_name}</p>
                  </div>
                </div>
              )}

              {!isPastEvent && (
                <Button
                  className="w-full"
                  size="lg"
                  variant={isUserAttending ? "default" : "outline"}
                  onClick={() => rsvpMutation.mutate(isUserAttending || false)}
                  disabled={rsvpMutation.isPending}
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendees List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Daftar warga ({attendees?.length || 0})
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
                <div className="space-y-3">
                  {attendees.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-mute transition-colors"
                    >
                      <Avatar>
                        <AvatarImage src={attendee.profile?.avatar_url || ""} />
                        <AvatarFallback>
                          {attendee.profile?.full_name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {attendee.profile?.full_name || "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {attendee.profile?.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        Hadir
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
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
