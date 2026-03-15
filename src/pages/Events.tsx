import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, isToday, isBefore } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalCompetitionList } from "@/components/competitions/GlobalCompetitionList";
import { EventCard, EmptyEventState } from "@/components/events/EventCard";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { EventDeleteDialog } from "@/components/events/EventDeleteDialog";
import { useEventMutations, useEventForm } from "@/hooks/events/useEventMutations";
import type { Event, EventRsvp } from "@/types/database";

export default function Events() {
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useEventForm();
  const { uploadImage, createMutation, updateMutation, deleteMutation, rsvpMutation } = useEventMutations();

  // ── Data fetching ─────────────────────────────────────────────────
  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .neq("event_type", "competition")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: rsvps = [] } = useQuery({
    queryKey: ["event-rsvps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_rsvps").select("*");
      if (error) throw error;
      return data as EventRsvp[];
    },
  });

  // ── Categorized events ────────────────────────────────────────────
  const { upcomingEvents, nowEvents, pastEvents } = useMemo(() => {
    if (!events) return { upcomingEvents: [], nowEvents: [], pastEvents: [] };
    const today = startOfDay(new Date());
    const upcoming: Event[] = [], now: Event[] = [], past: Event[] = [];

    events.forEach((event) => {
      const eventDay = startOfDay(new Date(event.event_date));
      if (isToday(new Date(event.event_date))) now.push(event);
      else if (isBefore(eventDay, today)) past.push(event);
      else upcoming.push(event);
    });

    upcoming.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    past.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
    now.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

    return { upcomingEvents: upcoming, nowEvents: now, pastEvents: past };
  }, [events]);

  // ── Form submit handler ───────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.eventDate) {
      toast({ variant: "destructive", title: "Error", description: "Judul dan tanggal wajib diisi" });
      return;
    }

    setIsUploading(true);
    let imageUrl: string | null = editingEvent?.image_url || null;

    if (form.imageFile) {
      const uploadedUrl = await uploadImage(form.imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal mengupload gambar" });
        setIsUploading(false);
        return;
      }
    } else if (!form.imagePreview) {
      imageUrl = null;
    }

    const data = {
      title: form.title,
      description: form.description,
      location: form.location,
      event_date: form.eventDate.toISOString(),
      event_time: form.eventTime || null,
      image_url: imageUrl,
      event_type: form.eventType,
    };

    setIsUploading(false);

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...data }, { onSuccess: () => { form.resetForm(); setEditingEvent(null); setIsCreateOpen(false); } });
    } else {
      createMutation.mutate(data, { onSuccess: () => { form.resetForm(); setIsCreateOpen(false); } });
    }
  };

  const handleEdit = (event: Event) => {
    form.populateForm(event);
    setEditingEvent(event);
    setIsCreateOpen(true);
  };

  const isFormLoading = createMutation.isPending || updateMutation.isPending || isUploading;

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        <Tabs defaultValue="events" className="w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
              <div>
                <h1 className="font-display text-2xl font-bold">Acara &amp; Kompetisi</h1>
                <p className="text-muted-foreground">Kegiatan dan perlombaan warga PKT</p>
              </div>
            </div>
            <TabsList className="grid w-full md:w-[400px] grid-cols-2">
              <TabsTrigger value="events">Acara</TabsTrigger>
              <TabsTrigger value="competitions">Kompetisi</TabsTrigger>
            </TabsList>
          </div>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1" />
              {canManageContent() && (
                <EventFormDialog
                  isOpen={isCreateOpen}
                  onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) { form.resetForm(); setEditingEvent(null); }
                  }}
                  editingEvent={editingEvent}
                  form={form}
                  onSubmit={handleSubmit}
                  isLoading={isFormLoading}
                />
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-12">
                {/* Hari Ini */}
                {nowEvents.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-xl font-bold">Hari Ini</h2>
                      <Badge variant="default" className="text-xs">{nowEvents.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {nowEvents.map((event, i) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          index={i}
                          rsvps={rsvps}
                          userId={user?.id}
                          canEdit={canManageContent() || event.author_id === user?.id}
                          canDelete={canManageContent() || event.author_id === user?.id}
                          isRsvpPending={rsvpMutation.isPending}
                          onRsvp={(id, attending) => rsvpMutation.mutate({ eventId: id, isAttending: attending })}
                          onEdit={handleEdit}
                          onDelete={setDeletingEvent}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Akan Datang */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold">Akan Datang</h2>
                    {upcomingEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{upcomingEvents.length}</Badge>
                    )}
                  </div>
                  {upcomingEvents.length === 0 ? (
                    <EmptyEventState message="Belum ada acara mendatang" />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {upcomingEvents.map((event, i) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          index={i}
                          rsvps={rsvps}
                          userId={user?.id}
                          canEdit={canManageContent() || event.author_id === user?.id}
                          canDelete={canManageContent() || event.author_id === user?.id}
                          isRsvpPending={rsvpMutation.isPending}
                          onRsvp={(id, attending) => rsvpMutation.mutate({ eventId: id, isAttending: attending })}
                          onEdit={handleEdit}
                          onDelete={setDeletingEvent}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Selesai */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold text-muted-foreground">Selesai</h2>
                  </div>
                  {pastEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Belum ada riwayat acara</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pastEvents.map((event, i) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          index={i}
                          isPast
                          rsvps={rsvps}
                          userId={user?.id}
                          canEdit={canManageContent() || event.author_id === user?.id}
                          canDelete={canManageContent() || event.author_id === user?.id}
                          isRsvpPending={rsvpMutation.isPending}
                          onRsvp={(id, attending) => rsvpMutation.mutate({ eventId: id, isAttending: attending })}
                          onEdit={handleEdit}
                          onDelete={setDeletingEvent}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </TabsContent>

          {/* Competitions Tab */}
          <TabsContent value="competitions" className="space-y-6">
            <GlobalCompetitionList canManage={canManageContent()} />
          </TabsContent>
        </Tabs>

        {/* Delete Dialog */}
        <EventDeleteDialog
          deletingEvent={deletingEvent}
          onClose={() => setDeletingEvent(null)}
          onConfirm={(id) => deleteMutation.mutate(id)}
        />
      </div>
    </section>
  );
}
