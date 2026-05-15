import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Search,
  Download,
  Eye,
  Upload,
} from "lucide-react";

interface RabDoc {
  id: string;
  title: string;
  description: string | null;
  pdf_url: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

interface RabDocWithUploader extends RabDoc {
  uploader_name?: string | null;
}

export default function RAB() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<RabDoc | null>(null);
  const [deleting, setDeleting] = useState<RabDoc | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<RabDoc | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["rab-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rab_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const uploaderIds = Array.from(
        new Set((data as RabDoc[]).map((d) => d.uploaded_by).filter(Boolean) as string[]),
      );
      let nameMap: Record<string, string> = {};
      if (uploaderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", uploaderIds);
        nameMap = Object.fromEntries((profs || []).map((p) => [p.id, p.full_name]));
      }
      return (data as RabDoc[]).map((d) => ({
        ...d,
        uploader_name: d.uploaded_by ? nameMap[d.uploaded_by] : null,
      })) as RabDocWithUploader[];
    },
  });

  // If route has param, find matching doc by id or title
  const routeDoc = useMemo(() => {
    if (!id || !docs) return null;
    return docs.find((d) => d.id === id || d.title.toLowerCase() === id.toLowerCase()) ?? null;
  }, [id, docs]);

  const filtered = useMemo(() => {
    if (!docs) return [];
    const q = search.toLowerCase().trim();
    if (!q) return docs;
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q),
    );
  }, [docs, search]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPdfFile(null);
    setEditing(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (d: RabDoc) => {
    setEditing(d);
    setTitle(d.title);
    setDescription(d.description ?? "");
    setPdfFile(null);
    setIsFormOpen(true);
  };

  const uploadPdf = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("rab-documents").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("rab-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Judul wajib diisi");
      setUploading(true);
      try {
        let pdfUrl = editing?.pdf_url ?? "";
        if (pdfFile) {
          pdfUrl = await uploadPdf(pdfFile);
        }
        if (!pdfUrl) throw new Error("File PDF wajib diunggah");

        if (editing) {
          const { error } = await supabase
            .from("rab_documents")
            .update({
              title: title.trim(),
              description: description.trim() || null,
              pdf_url: pdfUrl,
            })
            .eq("id", editing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("rab_documents").insert({
            title: title.trim(),
            description: description.trim() || null,
            pdf_url: pdfUrl,
            uploaded_by: user!.id,
          });
          if (error) throw error;
        }
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rab-documents"] });
      toast({ title: "Berhasil", description: editing ? "Dokumen diperbarui" : "Dokumen ditambahkan" });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (e: Error) =>
      toast({ variant: "destructive", title: "Gagal", description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (d: RabDoc) => {
      const { error } = await supabase.from("rab_documents").delete().eq("id", d.id);
      if (error) throw error;
      // try to remove storage file
      try {
        const url = new URL(d.pdf_url);
        const idx = url.pathname.indexOf("/rab-documents/");
        if (idx >= 0) {
          const path = decodeURIComponent(url.pathname.slice(idx + "/rab-documents/".length));
          await supabase.storage.from("rab-documents").remove([path]);
        }
      } catch {
        // ignore
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rab-documents"] });
      toast({ title: "Berhasil", description: "Dokumen dihapus" });
      setDeleting(null);
    },
    onError: () => toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus" }),
  });

  // Single-document viewer mode
  if (id) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!routeDoc) {
      return (
        <section className="min-h-screen p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Button variant="ghost" onClick={() => navigate("/rab")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Dokumen RAB tidak ditemukan</p>
              </CardContent>
            </Card>
          </div>
        </section>
      );
    }
    return (
      <section className="min-h-screen p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => navigate("/rab")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
            </Button>
            <Button asChild variant="outline">
              <a href={routeDoc.pdf_url} target="_blank" rel="noreferrer" download>
                <Download className="w-4 h-4 mr-2" /> Unduh
              </a>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-display">{routeDoc.title}</CardTitle>
              {routeDoc.description && <CardDescription>{routeDoc.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="w-full aspect-[3/4] md:aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
                <iframe
                  src={routeDoc.pdf_url}
                  className="w-full h-full"
                  title={routeDoc.title}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold">RAB</h1>
              <p className="text-sm text-muted-foreground">
                Rencana Anggaran Biaya - dokumen PDF paguyuban
              </p>
            </div>
          </div>
          {canManageContent() && (
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" /> Tambah RAB
            </Button>
          )}
        </motion.div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari berdasarkan judul atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {search ? "Tidak ada dokumen yang cocok" : "Belum ada dokumen RAB"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-display line-clamp-2 break-words">
                          {d.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(d.created_at), "d MMM yyyy", { locale: idLocale })}
                          {d.uploader_name && <> · {d.uploader_name}</>}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {d.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{d.description}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button size="sm" variant="default" onClick={() => setViewing(d)}>
                        <Eye className="w-4 h-4 mr-1" /> Lihat
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={d.pdf_url} target="_blank" rel="noreferrer" download>
                          <Download className="w-4 h-4 mr-1" /> Unduh
                        </a>
                      </Button>
                      {canManageContent() && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleOpenEdit(d)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => setDeleting(d)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={(o) => !o && (setIsFormOpen(false), resetForm())}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit RAB" : "Tambah RAB"}</DialogTitle>
              <DialogDescription>Unggah dokumen Rencana Anggaran Biaya (PDF)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rab-title">Judul *</Label>
                <Input
                  id="rab-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: RAB Acara 17 Agustus 2026"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rab-desc">Deskripsi</Label>
                <Textarea
                  id="rab-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi opsional..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rab-file">File PDF {editing ? "(opsional, biarkan kosong jika tidak diganti)" : "*"}</Label>
                <Input
                  id="rab-file"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                {editing && !pdfFile && (
                  <p className="text-xs text-muted-foreground">File saat ini tetap digunakan</p>
                )}
                {pdfFile && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Upload className="w-3 h-3" /> {pdfFile.name}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => (setIsFormOpen(false), resetForm())}>
                Batal
              </Button>
              <Button onClick={() => submitMut.mutate()} disabled={uploading || submitMut.isPending}>
                {(uploading || submitMut.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editing ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Viewer Dialog */}
        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="pr-8">{viewing?.title}</DialogTitle>
              {viewing?.description && <DialogDescription>{viewing.description}</DialogDescription>}
            </DialogHeader>
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border bg-muted">
              {viewing && (
                <iframe src={viewing.pdf_url} className="w-full h-full" title={viewing.title} />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" asChild>
                <a href={viewing?.pdf_url} target="_blank" rel="noreferrer" download>
                  <Download className="w-4 h-4 mr-2" /> Unduh
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus dokumen RAB?</AlertDialogTitle>
              <AlertDialogDescription>
                Dokumen "{deleting?.title}" akan dihapus permanen beserta file PDF-nya.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleting && deleteMut.mutate(deleting)}
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
