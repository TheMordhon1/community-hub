import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, isToday, isBefore, startOfDay } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  CalendarIcon,
  MapPin,
  Users,
  Loader2,
  Edit,
  Trash2,
  Check,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Event, EventRsvp } from "@/types/database";

type EventTab = "upcoming" | "now" | "past";

export default function Events() {
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [eventTime, setEventTime] = useState("");
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming");

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: rsvps } = useQuery({
    queryKey: ["event-rsvps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_rsvps").select("*");

      if (error) throw error;
      return data as EventRsvp[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      location: string;
      event_date: string;
      event_time: string | null;
    }) => {
      const { error } = await supabase.from("events").insert({
        title: data.title,
        description: data.description,
        location: data.location,
        event_date: data.event_date,
        event_time: data.event_time,
        author_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil dibuat" });
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal membuat acara",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      description: string;
      location: string;
      event_date: string;
      event_time: string | null;
    }) => {
      const { error } = await supabase
        .from("events")
        .update({
          title: data.title,
          description: data.description,
          location: data.location,
          event_date: data.event_date,
          event_time: data.event_time,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil diperbarui" });
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui acara",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus acara",
      });
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({
      eventId,
      isAttending,
    }: {
      eventId: string;
      isAttending: boolean;
    }) => {
      if (isAttending) {
        const { error } = await supabase
          .from("event_rsvps")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_rsvps").insert({
          event_id: eventId,
          user_id: user?.id,
          status: "attending",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-rsvps"] });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setEventDate(undefined);
    setEventTime("");
    setIsCreateOpen(false);
    setEditingEvent(null);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    setEventDate(new Date(event.event_date));
    setEventTime(event.event_time || "");
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim() || !eventDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Judul dan tanggal wajib diisi",
      });
      return;
    }

    const data = {
      title,
      description,
      location,
      event_date: eventDate.toISOString(),
      event_time: eventTime || null,
    };

    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isUserAttending = (eventId: string) => {
    return rsvps?.some((r) => r.event_id === eventId && r.user_id === user?.id);
  };

  const canEditEvent = (event: Event) => {
    return canManageContent() || event.author_id === user?.id;
  };

  const canDeleteEvent = (event: Event) => {
    return canManageContent() || event.author_id === user?.id;
  };

  const getAttendeeCount = () => {
    return rsvps?.filter((r) => r.status === "attending").length || 0;
  };

  // Categorize events
  const { upcomingEvents, nowEvents, pastEvents } = useMemo(() => {
    if (!events) return { upcomingEvents: [], nowEvents: [], pastEvents: [] };

    const today = startOfDay(new Date());

    const upcoming: Event[] = [];
    const now: Event[] = [];
    const past: Event[] = [];

    events.forEach((event) => {
      const eventDateObj = new Date(event.event_date);
      const eventDay = startOfDay(eventDateObj);

      if (isToday(eventDateObj)) {
        now.push(event);
      } else if (isBefore(eventDay, today)) {
        past.push(event);
      } else {
        upcoming.push(event);
      }
    });

    // Sort: upcoming by date ascending, past by date descending
    upcoming.sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );
    now.sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

    return { upcomingEvents: upcoming, nowEvents: now, pastEvents: past };
  }, [events]);

  const getTabEvents = () => {
    switch (activeTab) {
      case "upcoming":
        return upcomingEvents;
      case "now":
        return nowEvents;
      case "past":
        return pastEvents;
      default:
        return [];
    }
  };

  const formatEventTime = (time: string | null) => {
    if (!time) return null;
    // Format HH:mm:ss to HH:mm
    return time.substring(0, 5);
  };

  const renderEventCard = (event: Event, index: number, isPast = false) => (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={`/events/${event.id}`}>
        <Card
          className={cn(
            "overflow-hidden hover:shadow-lg transition-shadow cursor-pointer",
            isPast && "opacity-60"
          )}
        >
          <div className="flex">
            <div className="w-20 bg-primary/10 flex flex-col items-center justify-center p-3 text-center shrink-0">
              <span className="text-2xl font-bold text-primary">
                {format(new Date(event.event_date), "d")}
              </span>
              <span className="text-xs text-primary uppercase">
                {format(new Date(event.event_date), "MMM", {
                  locale: idLocale,
                })}
              </span>
              {event.event_time && (
                <span className="text-xs text-primary mt-1">
                  {formatEventTime(event.event_time)}
                </span>
              )}
            </div>
            <div className="flex-1 p-4 min-w-0">
              <div className="flex flex-col justify-between gap-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">
                      {event.title}
                    </h3>
                    {isPast && <Badge variant="secondary">Selesai</Badge>}
                    {isToday(new Date(event.event_date)) && !isPast && (
                      <Badge variant="default">Hari ini</Badge>
                    )}
                  </div>
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    {!isPast && (
                      <Button
                        variant={
                          isUserAttending(event.id) ? "default" : "outline"
                        }
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          rsvpMutation.mutate({
                            eventId: event.id,
                            isAttending: isUserAttending(event.id) || false,
                          });
                        }}
                        disabled={rsvpMutation.isPending}
                      >
                        {isUserAttending(event.id) ? (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Hadir
                          </>
                        ) : (
                          "Ikut"
                        )}
                      </Button>
                    )}
                    {canEditEvent(event) && !isPast && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleEdit(event);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {canDeleteEvent(event) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          setDeletingEvent(event);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  {event.description && (
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {event.event_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatEventTime(event.event_time)}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 shrink-0">
                      <Users className="w-3 h-3" />
                      {getAttendeeCount()} warga
                    </span>
                  </div>
                </div>
                <div className="flex md:hidden items-center gap-2">
                  {!isPast && (
                    <Button
                      variant={
                        isUserAttending(event.id) ? "default" : "outline"
                      }
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        rsvpMutation.mutate({
                          eventId: event.id,
                          isAttending: isUserAttending(event.id) || false,
                        });
                      }}
                      disabled={rsvpMutation.isPending}
                    >
                      {isUserAttending(event.id) ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Hadir
                        </>
                      ) : (
                        "Ikut"
                      )}
                    </Button>
                  )}
                  {canEditEvent(event) && !isPast && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        handleEdit(event);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {canDeleteEvent(event) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        setDeletingEvent(event);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );

  const currentTabEvents = getTabEvents();

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold">Acara</h1>
              <p className="text-muted-foreground">
                Kegiatan dan acara paguyuban
              </p>
            </div>
          </div>

          {canManageContent() && (
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="w-12 h-12 rounded-full fixed bottom-4 right-4 md:rounded-sm md:static flex md:w-auto md:h-auto justify-center items-center">
                  <Plus className="w-8 md:w-4 md:h-4 md:mr-2 mx-auto" />
                  <span className="hidden md:block">Buat Acara</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingEvent ? "Edit Acara" : "Buat Acara Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    Isi detail acara di bawah ini
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Acara</Label>
                    <Input
                      id="title"
                      placeholder="Judul acara"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea
                      id="description"
                      placeholder="Deskripsi acara..."
                      rows={10}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Lokasi</Label>
                    <Input
                      id="location"
                      placeholder="Lokasi acara"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tanggal</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !eventDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {eventDate
                              ? format(eventDate, "d MMM yyyy", {
                                  locale: idLocale,
                                })
                              : "Pilih tanggal"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0 bg-popover"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={eventDate}
                            onSelect={setEventDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Jam (opsional)</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="time"
                          type="time"
                          value={eventTime}
                          onChange={(e) => setEventTime(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Batal
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingEvent ? "Simpan" : "Buat"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as EventTab)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              Mendatang
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {upcomingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="now" className="flex items-center gap-2">
              Hari Ini
              {nowEvents.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {nowEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-2">
              Selesai
              {pastEvents.length > 0 && (
                <Badge variant="outline" className="ml-1">
                  {pastEvents.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Events List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="upcoming" className="space-y-3 mt-4">
                {upcomingEvents.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Tidak Ada Acara Mendatang
                      </h3>
                      <p className="text-muted-foreground">
                        Belum ada acara yang dijadwalkan
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  upcomingEvents.map((event, index) =>
                    renderEventCard(event, index)
                  )
                )}
              </TabsContent>

              <TabsContent value="now" className="space-y-3 mt-4">
                {nowEvents.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Tidak Ada Acara Hari Ini
                      </h3>
                      <p className="text-muted-foreground">
                        Tidak ada acara yang berlangsung hari ini
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  nowEvents.map((event, index) => renderEventCard(event, index))
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-3 mt-4">
                {pastEvents.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Tidak Ada Acara Selesai
                      </h3>
                      <p className="text-muted-foreground">
                        Belum ada acara yang sudah berlalu
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  pastEvents.map((event, index) =>
                    renderEventCard(event, index, true)
                  )
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Acara?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus acara "{deletingEvent?.title}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingEvent) {
                  deleteMutation.mutate(deletingEvent.id);
                  setDeletingEvent(null);
                }
              }}
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
