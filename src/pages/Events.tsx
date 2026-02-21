import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, isToday, isBefore, startOfDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn, formatEventTime } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlobalCompetitionList } from "@/components/competitions/GlobalCompetitionList";
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
  ImagePlus,
  X,
  Trophy,
  PartyPopper,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Event, EventRsvp, EventType } from "@/types/database";
import { TimePickerField } from "@/components/TimePickerDialog";



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
  const [eventType, setEventType] = useState<EventType>("regular");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: rsvps } = useQuery({
    queryKey: ["event-rsvps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_rsvps").select("*");

      if (error) throw error;
      return data as EventRsvp[];
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `events/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from("event-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      location: string;
      event_date: string;
      event_time: string | null;
      image_url: string | null;
      event_type: EventType;
    }) => {
      const { error } = await supabase.from("events").insert({
        title: data.title,
        description: data.description,
        location: data.location,
        event_date: data.event_date,
        event_time: data.event_time,
        image_url: data.image_url,
        event_type: data.event_type,
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
      image_url: string | null;
      event_type: EventType;
    }) => {
      const { error } = await supabase
        .from("events")
        .update({
          title: data.title,
          description: data.description,
          location: data.location,
          event_date: data.event_date,
          event_time: data.event_time,
          image_url: data.image_url,
          event_type: data.event_type,
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
    setEventType("regular");
    setImageFile(null);
    setImagePreview(null);
    setIsCreateOpen(false);
    setEditingEvent(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    setEventDate(new Date(event.event_date));
    setEventTime(event.event_time || "");
    setEventType(event.event_type || "regular");
    setImagePreview(event.image_url || null);
    setImageFile(null);
    setIsCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !eventDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Judul dan tanggal wajib diisi",
      });
      return;
    }

    setIsUploading(true);

    let imageUrl: string | null = editingEvent?.image_url || null;

    // Upload new image if selected
    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile);
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      } else {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal mengupload gambar",
        });
        setIsUploading(false);
        return;
      }
    } else if (!imagePreview) {
      // Image was removed
      imageUrl = null;
    }

    const data = {
      title,
      description,
      location,
      event_date: eventDate.toISOString(),
      event_time: eventTime || null,
      image_url: imageUrl,
      event_type: eventType,
    };

    setIsUploading(false);

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

  const getAttendeeCount = (evenId: string) => {
    return (
      rsvps?.filter((r) => evenId === r.event_id && r.status === "attending")
        .length || 0
    );
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
            "overflow-hidden hover:shadow-lg transition-all cursor-pointer group h-full flex flex-col",
            isPast && "opacity-60"
          )}
        >
          {/* Image or Date Section */}
          {event.image_url ? (
            <div className="relative w-full h-60 shrink-0 overflow-hidden">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-fill group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r" />
              <div className="absolute bottom-2 left-2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:left-1/2 md:-translate-x-1/2 text-center">
                <span className="text-2xl font-bold text-white drop-shadow-lg">
                  {format(new Date(event.event_date), "d")}
                </span>
                <span className="block text-xs text-white uppercase drop-shadow-lg">
                  {format(new Date(event.event_date), "MMMM", {
                    locale: idLocale,
                  })}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full h-60 bg-primary/10 flex flex-col items-center justify-center p-3 text-center shrink-0">
              <span className="text-2xl font-bold text-primary">
                {format(new Date(event.event_date), "d")}
              </span>
              <span className="text-xs text-primary uppercase">
                {format(new Date(event.event_date), "MMMM", {
                  locale: idLocale,
                })}
              </span>
            </div>
          )}

          <div className="flex flex-col justify-between gap-4 flex-1 p-4">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg line-clamp-1">
                  {event.title}
                </h3>
                {event.event_type === "competition" && (
                  <Badge variant="default" className="gap-1 bg-amber-500 hover:bg-amber-600">
                    <Trophy className="w-3 h-3" />
                    Kompetisi
                  </Badge>
                )}
                {isPast && <Badge variant="secondary">Selesai</Badge>}
                {isToday(new Date(event.event_date)) && !isPast && (
                  <Badge variant="default">Hari ini</Badge>
                )}
              </div>
              {/* <div className="hidden md:flex items-center gap-2 shrink-0">
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
                  </div> */}
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {event.description && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                  {event.description}
                </p>
              )}
              <div className="flex flex-col md:flex-row mt-auto md:items-center gap-2 md:gap-4  text-sm text-muted-foreground">
                {event.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatEventTime(event.event_time)}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1 max-w-52">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="line-clamp-1 w-full">
                      {event.location}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1 shrink-0">
                  <Users className="w-3 h-3" />
                  {getAttendeeCount(event.id)} warga
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-auto">
              {!isPast && (
                <Button
                  variant={isUserAttending(event.id) ? "default" : "outline"}
                  size="sm"
                  className="w-full hover:bg-success"
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
                    "Ikuti Acara"
                  )}
                </Button>
              )}
              {canEditEvent(event) && !isPast && (
                <Button
                  variant="ghost"
                  className="hover:bg-white transition hover:scale-125"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    handleEdit(event);
                  }}
                >
                  <Edit className="w-4 h-4" color="black" />
                </Button>
              )}
              {canDeleteEvent(event) && (
                <Button
                  variant="ghost"
                  className="hover:bg-white transition hover:scale-125"
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
        </Card>
      </Link>
    </motion.div>
  );

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        <Tabs defaultValue="events" className="w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-display text-2xl font-bold">Acara & Kompetisi</h1>
                <p className="text-muted-foreground">
                  Kegiatan dan perlombaan warga PKT
                </p>
              </div>
            </div>
            
            <TabsList className="grid w-full md:w-[400px] grid-cols-2">
              <TabsTrigger value="events">Acara</TabsTrigger>
              <TabsTrigger value="competitions">Kompetisi</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="events" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex-1" />
              {canManageContent() && (
                <Dialog
                  open={isCreateOpen}
                  onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="w-12 h-12 rounded-full fixed bottom-4 right-4 md:rounded-sm md:static flex md:w-auto md:h-auto justify-center items-center z-50">
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
                    <div className="space-y-4 py-4 max-h-[70vh] overflow-auto px-1">
                      {/* Event Type Selector */}
                      <div className="space-y-2">
                        <Label>Tipe Acara</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setEventType("regular")}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                              eventType === "regular"
                                ? "border-primary bg-primary/10"
                                : "border-muted hover:border-muted-foreground/30"
                            )}
                          >
                            <PartyPopper className={cn(
                              "w-8 h-8",
                              eventType === "regular" ? "text-primary" : "text-muted-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-medium text-sm",
                                eventType === "regular" ? "text-primary" : "text-foreground"
                              )}>Acara Biasa</p>
                              <p className="text-xs text-muted-foreground">Kegiatan, rapat, dll</p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEventType("competition")}
                            className={cn(
                              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                              eventType === "competition"
                                ? "border-primary bg-primary/10"
                                : "border-muted hover:border-muted-foreground/30"
                            )}
                          >
                            <Trophy className={cn(
                              "w-8 h-8",
                              eventType === "competition" ? "text-primary" : "text-muted-foreground"
                            )} />
                            <div className="text-center">
                              <p className={cn(
                                "font-medium text-sm",
                                eventType === "competition" ? "text-primary" : "text-foreground"
                              )}>Kompetisi</p>
                              <p className="text-xs text-muted-foreground">Lomba, turnamen, dll</p>
                            </div>
                          </button>
                        </div>
                      </div>

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

                      <TimePickerField
                        id="time"
                        label="Jam"
                        optional
                        value={eventTime}
                        onChange={setEventTime}
                      />

                      <div className="space-y-2">
                        <Label>Gambar (opsional)</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        {imagePreview ? (
                          <div className="relative rounded-lg overflow-hidden">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-40 object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={removeImage}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-24 border-dashed"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImagePlus className="w-6 h-6 mr-2" />
                            Tambah Gambar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col-reverse md:flex-row gap-4 items-center md:justify-end">
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="w-full hover:bg-secondary"
                      >
                        Batal
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={
                          createMutation.isPending ||
                          updateMutation.isPending ||
                          isUploading
                        }
                        className="w-full"
                      >
                        {(createMutation.isPending ||
                          updateMutation.isPending ||
                          isUploading) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingEvent ? "Simpan" : "Buat"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
                      <Badge variant="default" className="text-xs">
                        {nowEvents.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {nowEvents.map((event, index) =>
                        renderEventCard(event, index)
                      )}
                    </div>
                  </section>
                )}

                {/* Akan Datang */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold">Akan Datang</h2>
                    {upcomingEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {upcomingEvents.length}
                      </Badge>
                    )}
                  </div>
                  {upcomingEvents.length === 0 ? (
                    <Card className="py-8 bg-muted/30 border-dashed">
                      <CardContent className="flex flex-col items-center justify-center text-center">
                        <CalendarIcon className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">
                          Belum ada acara mendatang
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {upcomingEvents.map((event, index) =>
                        renderEventCard(event, index)
                      )}
                    </div>
                  )}
                </section>

                {/* Selesai */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold text-muted-foreground">
                      Selesai
                    </h2>
                  </div>
                  {pastEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Belum ada riwayat acara
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {pastEvents.map((event, index) =>
                        renderEventCard(event, index, true)
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </TabsContent>

          <TabsContent value="competitions" className="space-y-6">
            <GlobalCompetitionList canManage={canManageContent()} />
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={!!deletingEvent}
          onOpenChange={(open) => !open && setDeletingEvent(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Acara</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus acara ini? Tindakan ini tidak
                dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingEvent) {
                    deleteMutation.mutate(deletingEvent.id);
                    setDeletingEvent(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
