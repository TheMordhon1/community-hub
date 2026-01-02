import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BadgeCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

interface PengurusTitleRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  has_finance_access: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface TitleFormData {
  name: string;
  display_name: string;
  description: string;
  has_finance_access: boolean;
  order_index: number;
}

const initialFormData: TitleFormData = {
  name: "",
  display_name: "",
  description: "",
  has_finance_access: false,
  order_index: 0,
};

export default function AdminTitles() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState<PengurusTitleRow | null>(
    null
  );
  const [deletingTitle, setDeletingTitle] = useState<PengurusTitleRow | null>(
    null
  );
  const [formData, setFormData] = useState<TitleFormData>(initialFormData);

  // Redirect non-admin users
  useEffect(() => {
    if (!isAdmin()) {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  const { data: titles, isLoading } = useQuery({
    queryKey: ["pengurus-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pengurus_titles")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as PengurusTitleRow[];
    },
  });

  const { data: titleUsage } = useQuery({
    queryKey: ["title-usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("title_id")
        .not("title_id", "is", null);

      if (error) throw error;

      const usageMap: Record<string, number> = {};
      data.forEach((row) => {
        if (row.title_id) {
          usageMap[row.title_id] = (usageMap[row.title_id] || 0) + 1;
        }
      });
      return usageMap;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TitleFormData) => {
      const { error } = await supabase.from("pengurus_titles").insert({
        name: data.name.toLowerCase().replace(/\s+/g, "_"),
        display_name: data.display_name,
        description: data.description || null,
        has_finance_access: data.has_finance_access,
        order_index: data.order_index,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pengurus-titles"] });
      toast({
        title: "Berhasil",
        description: "Jabatan baru berhasil ditambahkan",
      });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message.includes("duplicate")
          ? "Nama jabatan sudah ada"
          : "Gagal menambahkan jabatan",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TitleFormData }) => {
      const { error } = await supabase
        .from("pengurus_titles")
        .update({
          name: data.name.toLowerCase().replace(/\s+/g, "_"),
          display_name: data.display_name,
          description: data.description || null,
          has_finance_access: data.has_finance_access,
          order_index: data.order_index,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pengurus-titles"] });
      toast({ title: "Berhasil", description: "Jabatan berhasil diperbarui" });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message.includes("duplicate")
          ? "Nama jabatan sudah ada"
          : "Gagal memperbarui jabatan",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pengurus_titles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pengurus-titles"] });
      queryClient.invalidateQueries({ queryKey: ["title-usage"] });
      toast({ title: "Berhasil", description: "Jabatan berhasil dihapus" });
      setIsDeleteOpen(false);
      setDeletingTitle(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus jabatan",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingTitle(null);
    setFormData({
      ...initialFormData,
      order_index: (titles?.length || 0) + 1,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (title: PengurusTitleRow) => {
    setEditingTitle(title);
    setFormData({
      name: title.name,
      display_name: title.display_name,
      description: title.description || "",
      has_finance_access: title.has_finance_access,
      order_index: title.order_index,
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTitle(null);
    setFormData(initialFormData);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.display_name.trim()) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Nama dan nama tampilan wajib diisi",
      });
      return;
    }

    if (editingTitle) {
      updateMutation.mutate({ id: editingTitle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (title: PengurusTitleRow) => {
    setDeletingTitle(title);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingTitle) {
      deleteMutation.mutate(deletingTitle.id);
    }
  };

  return (
    <section className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-xl md:text-2xl font-bold">
              Kelola Jabatan Pengurus
            </h1>
            <p className="text-sm text-muted-foreground">
              Tambah, ubah, atau hapus jabatan pengurus paguyuban
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Jabatan
          </Button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BadgeCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{titles?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Jabatan</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {titles?.filter((t) => t.has_finance_access).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Akses Keuangan</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Titles Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Daftar Jabatan</CardTitle>
            <CardDescription>
              Kelola jabatan pengurus paguyuban yang tersedia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nama Tampilan</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Kode
                      </TableHead>
                      <TableHead>Akses Keuangan</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Pengguna
                      </TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {titles?.map((title) => (
                      <TableRow key={title.id}>
                        <TableCell className="font-medium">
                          {title.order_index}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{title.display_name}</p>
                            {title.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {title.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {title.name}
                          </code>
                        </TableCell>
                        <TableCell>
                          {title.has_finance_access ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Ya
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Tidak</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline">
                            {titleUsage?.[title.id] || 0} orang
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(title)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(title)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!titles || titles.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Belum ada jabatan. Klik "Tambah Jabatan" untuk
                          membuat.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTitle ? "Edit Jabatan" : "Tambah Jabatan Baru"}
              </DialogTitle>
              <DialogDescription>
                {editingTitle
                  ? "Perbarui informasi jabatan pengurus"
                  : "Buat jabatan baru untuk pengurus paguyuban"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nama Tampilan *</Label>
                <Input
                  id="display_name"
                  placeholder="Contoh: Ketua paguyuban"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Kode (slug) *</Label>
                <Input
                  id="name"
                  placeholder="Contoh: ketua"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Kode unik untuk jabatan (huruf kecil, tanpa spasi)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  placeholder="Deskripsi singkat jabatan..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order_index">Urutan</Label>
                <Input
                  id="order_index"
                  type="number"
                  min={1}
                  value={formData.order_index}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order_index: parseInt(e.target.value) || 1,
                    })
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has_finance_access"
                  checked={formData.has_finance_access}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      has_finance_access: checked === true,
                    })
                  }
                />
                <Label htmlFor="has_finance_access" className="cursor-pointer">
                  Memiliki akses kelola keuangan
                </Label>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleCloseForm}
                className="w-full sm:w-auto"
              >
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="w-full sm:w-auto"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingTitle ? "Simpan Perubahan" : "Tambah Jabatan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Jabatan?</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus jabatan "
                {deletingTitle?.display_name}"?
                {titleUsage?.[deletingTitle?.id || ""] ? (
                  <span className="block mt-2 text-amber-600">
                    ⚠️ Jabatan ini masih digunakan oleh{" "}
                    {titleUsage[deletingTitle?.id || ""]} orang. Menghapus akan
                    menghapus jabatan dari pengguna tersebut.
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
