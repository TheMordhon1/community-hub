import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import { format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfDay, endOfDay, getDay, isWithinInterval, isSameMonth, isSameWeek, isSameYear } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import autoTable from "jspdf-autotable";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as ShadcnCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Plus,
  MapPin,
  Clock,
  Edit2,
  Trash2,
  Loader2,
  CalendarDays,
  X,
  ExternalLink,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format as formatDate } from "date-fns";
import { toast } from "sonner";
import type { Schedule, Event } from "@/types/database";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


// ---------------------------------------------------------------------------
// date-fns localizer for react-big-calendar
// ---------------------------------------------------------------------------
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { id: idLocale },
});


const COLOR_OPTIONS = [
  { label: "Ungu", value: "#6366f1" },
  { label: "Biru", value: "#3b82f6" },
  { label: "Hijau", value: "#22c55e" },
  { label: "Kuning", value: "#f59e0b" },
  { label: "Merah", value: "#ef4444" },
  { label: "Pink", value: "#ec4899" },
  { label: "Teal", value: "#14b8a6" },
];

// Event shape expected by react-big-calendar
interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  type: "event" | "schedule";
  raw: Event | Schedule;
}

interface ScheduleForm {
  title: string;
  description: string;
  location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  color: string;
}

const defaultForm: ScheduleForm = {
  title: "",
  description: "",
  location: "",
  start_date: formatDate(new Date(), "yyyy-MM-dd"),
  start_time: "",
  end_date: "",
  color: "#6366f1",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SchedulePage() {
  const navigate = useNavigate();
  const { user, isAdmin, canManageContent } = useAuth();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  type ExportRange = "day" | "week" | "month" | "year" | "custom";
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>("month");
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel">("pdf");
  
  const [exportStartDate, setExportStartDate] = useState(formatDate(new Date(), "yyyy-MM-dd"));
  const [exportEndDate, setExportEndDate] = useState(formatDate(new Date(), "yyyy-MM-dd"));

  // Fetch events
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["events-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_date, event_time, location, description, image_url, author_id, event_type, created_at, updated_at")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });

  // Fetch schedules
  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as Schedule[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Jadwal berhasil dihapus");
      setSelectedEvent(null);
      setDeleteTarget(null);
    },
    onError: () => toast.error("Gagal menghapus jadwal"),
  });

  // Convert to react-big-calendar events using strict local Date constructors
  // to avoid timezone drift hiding events from the grid
  const createLocalEventDate = (dateStr: string, timeStr: string) => {
    try {
      if (!dateStr) return new Date();
      let year, month, day;

      if (dateStr.includes("T")) {
        const d = new Date(dateStr);
        year = d.getFullYear();
        month = d.getMonth() + 1; // 1-indexed for consistent math below
        day = d.getDate();
      } else {
        [year, month, day] = dateStr.substring(0, 10).split('-').map(Number);
      }

      if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date();
      
      const timeMatch = (timeStr || "00:00").match(/(\d{2}):(\d{2})/);
      const hours = timeMatch ? parseInt(timeMatch[1], 10) : 0;
      const minutes = timeMatch ? parseInt(timeMatch[2], 10) : 0;
      return new Date(year, month - 1, day, hours, minutes);
    } catch {
      return new Date();
    }
  };


  const calEvents: CalEvent[] = [
    ...events.map((e): CalEvent => {
      const start = createLocalEventDate(e.event_date, e.event_time || "00:00");
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1hr default
      return { id: e.id, title: e.title, start, end, color: "hsl(var(--primary))", type: "event", raw: e };
    }),
    ...schedules.map((s): CalEvent => {
      const start = createLocalEventDate(s.start_date, s.start_time || "00:00");
      let end: Date;
      if (s.end_date) {
        end = createLocalEventDate(s.end_date, "23:59");
      } else {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      return { id: s.id, title: s.title, start, end, color: s.color || "#6366f1", type: "schedule", raw: s };
    }),
  ].filter(ev => !isNaN(ev.start.getTime())); // Strip any remaining invalid dates to prevent crashes

  // Slot select → open create with pre-filled date
  const handleSelectSlot = ({ start }: { start: Date }) => {
    setEditingSchedule(null);
    setForm({ ...defaultForm, start_date: formatDate(start, "yyyy-MM-dd") });
    setIsFormOpen(true);
  };


  // Click event → show mini-detail panel
  const handleSelectEvent = (event: CalEvent) => {
    setSelectedEvent(event);
  };

  // Style each event by color
  const eventStyleGetter = (event: CalEvent) => ({
    style: {
      backgroundColor: event.color,
      border: "none",
      borderRadius: "6px",
      color: "#fff",
      fontSize: "0.72rem",
      padding: "1px 6px",
      cursor: "pointer",
    },
  });

  const openEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setForm({
      title: schedule.title,
      description: schedule.description || "",
      location: schedule.location || "",
      start_date: schedule.start_date,
      start_time: schedule.start_time || "",
      end_date: schedule.end_date || "",
      color: schedule.color || "#6366f1",
    });
    setSelectedEvent(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_date) { toast.error("Judul dan tanggal wajib diisi"); return; }
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        start_date: form.start_date,
        start_time: form.start_time.trim() || null,
        end_date: form.end_date.trim() || null,
        color: form.color,
        created_by: user.id,
      };
      if (editingSchedule) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", editingSchedule.id);
        if (error) throw error;
        toast.success("Jadwal diperbarui");
      } else {
        const { error } = await supabase.from("schedules").insert(payload);
        if (error) throw error;
        toast.success("Jadwal ditambahkan");
      }
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setIsFormOpen(false);
    } catch { toast.error("Gagal menyimpan jadwal"); }
    finally { setIsSaving(false); }
  };

  const canEdit = (sc: Schedule) =>
    sc.created_by === user?.id || isAdmin() || canManageContent();

  // Indonesian messages for react-big-calendar
  const messages = {
    today: "Hari Ini",
    previous: <ChevronLeft className="w-4 h-4" />,
    next: <ChevronRight className="w-4 h-4" />,
    month: "Bulan",
    week: "Minggu",
    day: "Hari",
    agenda: "Agenda",
    date: "Tanggal",
    time: "Waktu",
    event: "Kegiatan",
    noEventsInRange: "Tidak ada kegiatan dalam periode ini.",
    showMore: (total: number) => `+${total} lagi`,
  };

  const handleRangePreset = (range: ExportRange) => {
    setExportRange(range);
    const today = currentDate;
    let startD = today;
    let endD = today;

    switch (range) {
      case "day":
        startD = startOfDay(today);
        endD = endOfDay(today);
        break;
      case "week":
        startD = startOfWeek(today, { weekStartsOn: 1 });
        endD = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "year":
        startD = startOfYear(today);
        endD = endOfYear(today);
        break;
      case "month":
        startD = startOfMonth(today);
        endD = endOfMonth(today);
        break;
    }
    
    if (range !== "custom") {
      setExportStartDate(formatDate(startD, "yyyy-MM-dd"));
      setExportEndDate(formatDate(endD, "yyyy-MM-dd"));
    }
  };

  const getVisibleEvents = () => {
    const startRange = startOfDay(new Date(exportStartDate));
    const endRange = endOfDay(new Date(exportEndDate));

    return calEvents
      .filter(ev => isWithinInterval(ev.start, { start: startRange, end: endRange }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  };

// ... Inside component:
  const handleExport = () => {
    if (exportFormat === "pdf") {
      exportAgendaPDF();
    } else {
      exportAgendaExcel();
    }
    setIsExportOpen(false);
  };

  const getRangeLabel = () => {
    if (exportRange === "custom" || exportStartDate !== exportEndDate) {
      return `${formatDate(new Date(exportStartDate), "dd MMM yyyy", { locale: idLocale })} - ${formatDate(new Date(exportEndDate), "dd MMM yyyy", { locale: idLocale })}`;
    }
    switch (exportRange) {
      case "day": return "Satu Hari";
      case "week": return "Satu Minggu";
      case "year": return "Satu Tahun";
      case "month":
      default: return "Satu Bulan";
    }
  };

  const exportAgendaPDF = () => {
    const doc = new jsPDF();
    const visibleEvents = getVisibleEvents();
    
    doc.setFontSize(18);
    doc.text("Laporan Agenda Kegiatan Warga PKT", 14, 22);
    doc.setFontSize(12);
    
    // e.g "Periode: Minggu Ini"
    doc.text(`Periode: ${getRangeLabel()}`, 14, 32);
    doc.text(
      `Tanggal Cetak: ${formatDate(new Date(), "dd MMMM yyyy", {
        locale: idLocale,
      })}`,
      14,
      40
    );

    const totalEvents = visibleEvents.length;
    doc.setFontSize(11);
    doc.text(`Total Kegiatan: ${totalEvents}`, 14, 52);

    const tableData = visibleEvents.map((ev) => [
      formatDate(ev.start, "dd MMM yyyy", { locale: idLocale }),
      formatDate(ev.start, "HH:mm"),
      ev.title,
      ev.raw.location || "-",
    ]);

    autoTable(doc, {
      startY: 65,
      head: [["Tanggal", "Waktu", "Kegiatan", "Lokasi"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] }, // Finance blue
    });

    doc.save(`laporan-agenda-${exportRange}-${formatDate(currentDate, "MMM-yyyy")}.pdf`);
    toast.success("Laporan PDF berhasil diunduh");
  };

  const exportAgendaExcel = () => {
    const visibleEvents = getVisibleEvents();
    const data = visibleEvents.map((ev) => ({
      Tanggal: formatDate(ev.start, "dd MMM yyyy", { locale: idLocale }),
      Waktu: formatDate(ev.start, "HH:mm"),
      Kegiatan: ev.title,
      Lokasi: ev.raw.location || "-",
      Deskripsi: "description" in ev.raw && ev.raw.description ? ev.raw.description : "-",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Agenda");
    XLSX.writeFile(wb, `laporan-agenda-${exportRange}-${formatDate(currentDate, "MMM-yyyy")}.xlsx`);
    toast.success("Laporan Excel berhasil diunduh");
  };


  return (
    <section className="flex flex-col gap-5 p-4 sm:p-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Agenda</h1>
            <p className="text-sm text-muted-foreground">Kalender kegiatan paguyuban</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {currentView === Views.AGENDA && (
            <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setIsExportOpen(true)}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Ekspor</span>
            </Button>
          )}
          <Button onClick={() => { setEditingSchedule(null); setForm(defaultForm); setIsFormOpen(true); }} className="gap-2 h-9">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Jadwal</span>
            <span className="sm:hidden">Tambah</span>
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border rounded-2xl shadow-sm p-3 sm:p-4 flex-1 min-h-[520px] rbc-wrapper">
        <style>{`
          .rbc-wrapper .rbc-toolbar { margin-bottom: 12px; gap: 8px; flex-wrap: wrap; }
          .rbc-wrapper .rbc-toolbar-label { font-weight: 600; font-size: 1rem; }
          .rbc-wrapper .rbc-btn-group button { border-radius: 8px; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); color: hsl(var(--foreground)); font-size: 0.8rem; padding: 4px 10px; }
          .rbc-wrapper .rbc-btn-group button:hover { background: hsl(var(--muted)); }
          .rbc-wrapper .rbc-btn-group button.rbc-active { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-color: hsl(var(--primary)); }
          .rbc-wrapper .rbc-header { padding: 6px 0; font-size: 0.75rem; font-weight: 500; color: hsl(var(--muted-foreground)); }
          .rbc-wrapper .rbc-today { background: hsl(var(--primary) / 0.06); }
          .rbc-wrapper .rbc-off-range-bg { background: hsl(var(--muted) / 0.4); }
          .rbc-wrapper .rbc-date-cell { font-size: 0.8rem; padding: 2px 6px; }
          .rbc-wrapper .rbc-show-more { font-size: 0.72rem; color: hsl(var(--primary)); background: transparent; }
          .rbc-wrapper .rbc-event { padding: 2px 6px; font-size: 0.72rem; min-height: 22px; margin-bottom: 2px; }
          .rbc-wrapper .rbc-event:focus { outline: none; }
          .rbc-wrapper .rbc-slot-selection { background: hsl(var(--primary) / 0.15); }
        `}</style>
        <Calendar
          localizer={localizer}
          events={calEvents}
          date={currentDate}
          view={currentView}
          onNavigate={setCurrentDate}
          onView={setCurrentView}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          messages={messages}
          style={{ height: "100%", minHeight: 480 }}
          culture="id"
          popup
          showMultiDayTimes
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
        />
      </div>

      {/* Event detail side-panel */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            key="detail-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="bg-card border rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="flex items-start justify-between p-4 pb-3 border-b gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedEvent.color }} />
                <p className="font-semibold text-sm truncate">{selectedEvent.title}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedEvent.type === "event" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => navigate(`/events/${selectedEvent.id}`)}>
                    <ExternalLink className="w-3 h-3" /> Lihat Acara
                  </Button>
                ) : (
                  <>
                    {canEdit(selectedEvent.raw as Schedule) && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(selectedEvent.raw as Schedule)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(selectedEvent.raw as Schedule)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => navigate(`/schedule/${selectedEvent.id}`)}>
                          <ExternalLink className="w-3 h-3" /> Detail
                        </Button>
                      </>
                    )}
                    {!canEdit(selectedEvent.raw as Schedule) && (
                      <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => navigate(`/schedule/${selectedEvent.id}`)}>
                        <ExternalLink className="w-3 h-3" /> Detail
                      </Button>
                    )}
                  </>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedEvent(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(selectedEvent.start, "EEEE, d MMMM yyyy", { locale: idLocale })}
              </span>
              {(selectedEvent.raw as Schedule | Event) && (
                (() => {
                  const r = selectedEvent.raw;
                  const time = (r as Schedule).start_time || (r as Event).event_time;
                  const loc = (r as Schedule).location || (r as Event).location;
                  return (
                    <>
                      {time && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5" />{time}</span>}
                      {loc && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{loc}</span>}
                    </>
                  );
                })()
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? "Edit Jadwal" : "Tambah Jadwal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Judul *</Label>
              <Input placeholder="Nama kegiatan" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea placeholder="Keterangan tambahan..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Lokasi</Label>
              <Input placeholder="Lokasi kegiatan" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tanggal Mulai *</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam</Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai (opsional)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, color: c.value })} style={{ backgroundColor: c.value }}
                    className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c.value ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingSchedule ? "Simpan Perubahan" : "Tambah Jadwal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
            <AlertDialogDescription>
              Jadwal "{deleteTarget?.title}" akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Export Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ekspor Jadwal Kegiatan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Periode</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["day", "week", "month", "year"] as const).map((range) => (
                  <Button
                    key={range}
                    variant={exportRange === range ? "default" : "outline"}
                    className="w-full text-xs sm:text-sm px-2"
                    onClick={() => handleRangePreset(range)}
                  >
                    {range === "day" && "Satu Hari"}
                    {range === "week" && "Satu Minggu"}
                    {range === "month" && "Satu Bulan"}
                    {range === "year" && "Satu Tahun"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-2">
                <Label>Dari Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal", !exportStartDate && "text-muted-foreground")}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {exportStartDate ? formatDate(new Date(exportStartDate), "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <ShadcnCalendar
                      mode="single"
                      selected={exportStartDate ? new Date(exportStartDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setExportStartDate(formatDate(date, "yyyy-MM-dd"));
                          if (exportRange === "day") {
                            setExportEndDate(formatDate(date, "yyyy-MM-dd"));
                          } else if (exportRange === "week") {
                            // Automatically set exactly 6 days later to make it 1 full week
                            setExportEndDate(formatDate(new Date(date.getTime() + 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
                          } else if (exportRange === "month") {
                            // +1 month minus 1 day
                            const nextMonth = new Date(date);
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            nextMonth.setDate(nextMonth.getDate() - 1);
                            setExportEndDate(formatDate(nextMonth, "yyyy-MM-dd"));
                          } else if (exportRange === "year") {
                            // +1 year minus 1 day
                            const nextYear = new Date(date);
                            nextYear.setFullYear(nextYear.getFullYear() + 1);
                            nextYear.setDate(nextYear.getDate() - 1);
                            setExportEndDate(formatDate(nextYear, "yyyy-MM-dd"));
                          } else {
                            if (new Date(exportEndDate) < date) {
                              setExportEndDate(formatDate(date, "yyyy-MM-dd"));
                            }
                          }
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Sampai Tanggal</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-left font-normal", !exportEndDate && "text-muted-foreground")}
                      disabled={exportRange === "day"}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {exportEndDate ? formatDate(new Date(exportEndDate), "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <ShadcnCalendar
                      mode="single"
                      selected={exportEndDate ? new Date(exportEndDate) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setExportEndDate(formatDate(date, "yyyy-MM-dd"));
                          setExportRange("custom");
                        }
                      }}
                      disabled={(date) => {
                        const start = startOfDay(new Date(exportStartDate));
                        if(exportRange === "day") {
                            // Only allow the exact same day
                            return date.getTime() !== start.getTime();
                        }
                        if (exportRange === "week") {
                          // Allow exactly +6 days
                          const exactEnd = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
                          return date.getTime() !== exactEnd.getTime();
                        }
                        if (exportRange === "month") {
                          // Allow +1 month -1 day
                          const exactEnd = new Date(start);
                          exactEnd.setMonth(exactEnd.getMonth() + 1);
                          exactEnd.setDate(exactEnd.getDate() - 1);
                          return date.getTime() !== exactEnd.getTime();
                        }
                        if (exportRange === "year") {
                          // Allow +1 year -1 day
                          const exactEnd = new Date(start);
                          exactEnd.setFullYear(exactEnd.getFullYear() + 1);
                          exactEnd.setDate(exactEnd.getDate() - 1);
                          return date.getTime() !== exactEnd.getTime();
                        }
                        return date < start; // custom: don't allow end < start
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label>Format File</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={exportFormat === "pdf" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setExportFormat("pdf")}
                >
                  PDF
                </Button>
                <Button
                  variant={exportFormat === "excel" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setExportFormat("excel")}
                >
                  Excel
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportOpen(false)}>Batal</Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" /> Unduh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
