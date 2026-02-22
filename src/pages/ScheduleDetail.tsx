import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Edit2,
  Trash2,
  Loader2,
  User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import type { Schedule } from "@/types/database";

const COLOR_OPTIONS = [
  { label: "Ungu", value: "#6366f1" },
  { label: "Biru", value: "#3b82f6" },
  { label: "Hijau", value: "#22c55e" },
  { label: "Kuning", value: "#f59e0b" },
  { label: "Merah", value: "#ef4444" },
  { label: "Pink", value: "#ec4899" },
  { label: "Teal", value: "#14b8a6" },
];

interface ScheduleForm {
  title: string;
  description: string;
  location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  color: string;
}

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, canManageContent } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: schedule, isLoading } = useQuery<Schedule>({
    queryKey: ["schedule", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Schedule;
    },
    enabled: !!id,
  });

  // Creator profile
  const { data: creator } = useQuery({
    queryKey: ["profile", schedule?.created_by],
    queryFn: async () => {
      if (!schedule?.created_by) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", schedule.created_by)
        .maybeSingle();
      return data;
    },
    enabled: !!schedule?.created_by,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedules").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Jadwal berhasil dihapus");
      navigate("/schedule");
    },
    onError: () => toast.error("Gagal menghapus jadwal"),
  });

  const canEdit = schedule
    ? schedule.created_by === user?.id || isAdmin() || canManageContent()
    : false;

  const openEdit = () => {
    if (!schedule) return;
    setForm({
      title: schedule.title,
      description: schedule.description || "",
      location: schedule.location || "",
      start_date: schedule.start_date,
      start_time: schedule.start_time || "",
      end_date: schedule.end_date || "",
      color: schedule.color || "#6366f1",
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form || !id) return;
    if (!form.title.trim() || !form.start_date) {
      toast.error("Judul dan tanggal mulai wajib diisi");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("schedules")
        .update({
          title: form.title.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          start_date: form.start_date,
          start_time: form.start_time.trim() || null,
          end_date: form.end_date.trim() || null,
          color: form.color,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Jadwal berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["schedule", id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setIsFormOpen(false);
    } catch {
      toast.error("Gagal menyimpan jadwal");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Jadwal tidak ditemukan.</p>
        <Button variant="outline" asChild>
          <Link to="/schedule"><ArrowLeft className="w-4 h-4 mr-2" /> Kembali</Link>
        </Button>
      </div>
    );
  }

  const accentColor = schedule.color || "#6366f1";

  return (
    <section className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link to="/schedule">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Jadwal
          </Link>
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden">
            {/* Color accent header */}
            <div className="h-2" style={{ backgroundColor: accentColor }} />

            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full mt-0.5 shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                  <CardTitle className="text-xl leading-snug">{schedule.title}</CardTitle>
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Jadwal "{schedule.title}" akan dihapus secara permanen. Aksi ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate()}
                          >
                            {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Meta info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <CalendarDays className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tanggal</p>
                    <p className="text-sm font-medium">
                      {format(parseISO(schedule.start_date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                      {schedule.end_date && schedule.end_date !== schedule.start_date && (
                        <span className="text-muted-foreground font-normal">
                          {" "}– {format(parseISO(schedule.end_date), "d MMMM yyyy", { locale: idLocale })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {schedule.start_time && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                    <Clock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Waktu</p>
                      <p className="text-sm font-medium">{schedule.start_time}</p>
                    </div>
                  </div>
                )}

                {schedule.location && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Lokasi</p>
                      <p className="text-sm font-medium">{schedule.location}</p>
                    </div>
                  </div>
                )}

                {creator && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                    <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dibuat oleh</p>
                      <p className="text-sm font-medium">{creator.full_name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {schedule.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Deskripsi</p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{schedule.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Edit dialog */}
      {form && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Jadwal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Judul *</Label>
                <Input
                  placeholder="Nama kegiatan"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  placeholder="Keterangan tambahan..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input
                  placeholder="Lokasi kegiatan"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tanggal Mulai *</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jam</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Selesai (opsional)</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Warna</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setForm({ ...form, color: c.value })}
                      style={{ backgroundColor: c.value }}
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
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
