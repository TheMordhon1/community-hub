import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAnnouncementCategories, type AnnouncementCategoryRow } from "@/hooks/useAnnouncementCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Tag } from "lucide-react";

interface FormData {
  name: string;
  order_index: number;
}

const initial: FormData = { name: "", order_index: 0 };

export default function AnnouncementCategoriesAdmin() {
  const navigate = useNavigate();
  const { canManageContent } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories, isLoading } = useAnnouncementCategories();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementCategoryRow | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementCategoryRow | null>(null);
  const [form, setForm] = useState<FormData>(initial);

  if (!canManageContent()) {
    navigate("/dashboard");
    return null;
  }

  const createMut = useMutation({
    mutationFn: async (d: FormData) => {
      const { error } = await supabase.from("announcement_categories").insert({
        name: d.name.trim(),
        order_index: d.order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcement-categories"] });
      toast({ title: "Berhasil", description: "Kategori ditambahkan" });
      handleClose();
    },
    onError: (e: Error) =>
      toast({
        variant: "destructive",
        title: "Gagal",
        description: e.message.includes("duplicate") ? "Nama kategori sudah ada" : "Gagal menambahkan",
      }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: FormData }) => {
      const { error } = await supabase
        .from("announcement_categories")
        .update({ name: d.name.trim(), order_index: d.order_index })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcement-categories"] });
      toast({ title: "Berhasil", description: "Kategori diperbarui" });
      handleClose();
    },
    onError: () => toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcement_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcement-categories"] });
      toast({ title: "Berhasil", description: "Kategori dihapus" });
      setDeleting(null);
    },
    onError: () => toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus" }),
  });

  const handleClose = () => {
    setIsFormOpen(false);
    setEditing(null);
    setForm(initial);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setForm({ name: "", order_index: (categories?.length ?? 0) + 1 });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: AnnouncementCategoryRow) => {
    setEditing(c);
    setForm({ name: c.name, order_index: c.order_index });
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Validasi", description: "Nama kategori wajib diisi" });
      return;
    }
    if (editing) updateMut.mutate({ id: editing.id, d: form });
    else createMut.mutate(form);
  };

  return (
    <section className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <Link to="/announcements">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold">Kelola Kategori Pengumuman</h1>
              <p className="text-sm text-muted-foreground">Tambah, ubah, atau hapus kategori pengumuman</p>
            </div>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" /> Tambah Kategori
          </Button>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Daftar Kategori</CardTitle>
            <CardDescription>Diurutkan berdasarkan urutan</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !categories?.length ? (
              <div className="text-center py-12 text-muted-foreground">Belum ada kategori</div>
            ) : (
              <div className="space-y-2">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">Urutan: {c.order_index}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isFormOpen} onOpenChange={(o) => !o && handleClose()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
              <DialogDescription>Kategori untuk mengelompokkan pengumuman</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Kategori *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Pengumuman Penting"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Urutan</Label>
                <Input
                  id="order"
                  type="number"
                  min={0}
                  value={form.order_index}
                  onChange={(e) => setForm({ ...form, order_index: Number.parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
              <AlertDialogDescription>
                Kategori "{deleting?.name}" akan dihapus permanen. Pengumuman dengan kategori ini tidak akan
                terhapus tapi akan kehilangan referensi kategori.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleting && deleteMut.mutate(deleting.id)}
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
