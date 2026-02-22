import { useState, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  ArrowLeft,
  Plus,
  Megaphone,
  Loader2,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  X,
  ImageIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Announcement } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50];
const DEFAULT_ITEMS_PER_PAGE = 10;

export default function Announcements() {
  const { user, canManageContent } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] =
    useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [relatedUrl, setRelatedUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: announcementData, isLoading } = useQuery({
    queryKey: ["announcements", currentPage, itemsPerPage],
    queryFn: async () => {
      const offset = (currentPage - 1) * itemsPerPage;

      const { count: totalCount } = await supabase
        .from("announcements")
        .select("*", { count: "exact", head: true });

      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + itemsPerPage - 1);

      if (error) throw error;
      return {
        data: data as Announcement[],
        totalCount: totalCount || 0,
      };
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_settings")
        .select("key, value");
      if (error) throw error;
      const settingsObj: Record<string, string | null> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value;
      });
      return settingsObj;
    },
  });

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `announcements/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("announcement-images")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from("announcement-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      related_url: string | null;
      is_published: boolean;
      image_url: string | null;
    }) => {
      const { error } = await supabase.from("announcements").insert({
        title: data.title,
        content: data.content,
        related_url: data.related_url,
        is_published: data.is_published,
        image_url: data.image_url,
        published_at: data.is_published ? new Date().toISOString() : null,
        author_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Berhasil", description: "Pengumuman berhasil dibuat" });
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Create announcement error:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal membuat pengumuman",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      content: string;
      related_url: string | null;
      is_published: boolean;
      image_url: string | null;
    }) => {
      const { error } = await supabase
        .from("announcements")
        .update({
          title: data.title,
          content: data.content,
          related_url: data.related_url,
          is_published: data.is_published,
          image_url: data.image_url,
          published_at: data.is_published ? new Date().toISOString() : null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({
        title: "Berhasil",
        description: "Pengumuman berhasil diperbarui",
      });
      resetForm();
    },
    onError: (error: Error) => {
      console.error("Update announcement error:", error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal memperbarui pengumuman",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Berhasil", description: "Pengumuman berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus pengumuman",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setRelatedUrl("");
    setIsPublished(false);
    setImageFile(null);
    setImagePreview(null);
    setIsCreateOpen(false);
    setEditingAnnouncement(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSizeMB = Number.parseFloat(settings?.announcement_max_image_size || "1");
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      if (file.size > maxSizeBytes) {
        toast({
          variant: "destructive",
          title: "Ukuran Gambar Terlalu Besar",
          description: `Maksimal ukuran gambar adalah ${maxSizeMB}MB`,
        });
        return;
      }

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

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setRelatedUrl(announcement.related_url || "");
    setIsPublished(announcement.is_published);
    setImagePreview(announcement.image_url || null);
    setImageFile(null);
    setIsCreateOpen(true);
  };

  const handleLimitChange = (newLimit: string) => {
    const limit = Number.parseInt(newLimit);
    setItemsPerPage(limit);
    setCurrentPage(1);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Judul dan isi wajib diisi",
      });
      return;
    }

    setIsUploading(true);
    let imageUrl = editingAnnouncement?.image_url || null;

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
      imageUrl = null;
    }

    const payload = {
      title,
      content,
      related_url: relatedUrl.trim() || null,
      is_published: isPublished,
      image_url: imageUrl,
    };

    if (editingAnnouncement) {
      updateMutation.mutate({
        id: editingAnnouncement.id,
        ...payload,
      });
    } else {
      createMutation.mutate(payload);
    }
    setIsUploading(false);
  };

  const announcements = announcementData?.data || [];
  const totalCount = announcementData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const publishedAnnouncements =
    announcements.filter((a) => a.is_published) || [];
  const draftAnnouncements = announcements.filter((a) => !a.is_published) || [];

  return (
    <section className="min-h-screen bg-background px-4 pt-6 pb-24 sm:p-6 overflow-x-hidden">
      <div className="space-y-6">
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
              <h1 className="font-display text-xl sm:text-2xl font-bold">Pengumuman</h1>
              <p className="text-muted-foreground">
                Informasi terbaru dari pengurus
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
                  <span className="hidden md:block">Buat Pengumuman</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingAnnouncement
                      ? "Edit Pengumuman"
                      : "Buat Pengumuman Baru"}
                  </DialogTitle>
                  <DialogDescription>
                    Isi informasi pengumuman di bawah ini
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[75vh] px-1 overflow-hidden rounded-md">
                  <div className="space-y-6 py-4 px-2">
                    <div className="space-y-2">
                      <Label htmlFor="title" className="text-sm font-semibold text-foreground/80">Judul Pengumuman</Label>
                      <Input
                        id="title"
                        placeholder="Masukkan judul yang menarik..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="content" className="text-sm font-semibold text-foreground/80">Isi Pengumuman</Label>
                      <Textarea
                        id="content"
                        placeholder="Tulis informasi lengkap di sini..."
                        rows={8}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="resize-none transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-foreground/80">Media Gambar</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      {imagePreview ? (
                        <div className="group relative rounded-xl overflow-hidden border-2 border-primary/10 shadow-lg transition-all hover:shadow-xl">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-9 rounded-full bg-white/90 hover:bg-white text-foreground"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Ubah
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-9 w-9 rounded-full"
                              onClick={removeImage}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full h-32 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition-all duration-300 group"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <ImagePlus className="w-6 h-6 text-primary" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-semibold text-foreground/70 tracking-tight">Klik untuk Upload Gambar</p>
                            <p className="text-[10px] text-muted-foreground">PNG, JPG atau WEBP (Maks. 5MB)</p>
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="relatedUrl" className="text-sm font-semibold text-foreground/80 flex items-center gap-1.5">
                          Link Terkait <span className="text-[10px] font-normal text-muted-foreground">(Opsional)</span>
                        </Label>
                        <Input
                          id="relatedUrl"
                          placeholder="https://contoh.com/informasi-lanjutan"
                          value={relatedUrl}
                          onChange={(e) => setRelatedUrl(e.target.value)}
                          className="h-10 transition-all focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-xl border bg-primary/5 border-primary/10">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold text-foreground/90">Publikasikan Sekarang</Label>
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            Aktifkan agar pengumuman ini langsung dapat dilihat oleh warga
                          </p>
                        </div>
                        <Switch
                          checked={isPublished}
                          onCheckedChange={setIsPublished}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
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
                    {(createMutation.isPending || updateMutation.isPending || isUploading) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingAnnouncement ? "Simpan" : "Buat"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : publishedAnnouncements.length === 0 &&
          (!canManageContent() || draftAnnouncements.length === 0) ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Belum Ada Pengumuman
              </h3>
              <p className="text-muted-foreground">
                Pengumuman dari pengurus akan muncul di sini
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8 mb-10">
            {canManageContent() && draftAnnouncements.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Draft
                </h2>
                {draftAnnouncements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 border-dashed"
                      onClick={() => handleEdit(announcement)}
                    >
                      <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                              <EyeOff className="w-3 h-3 mr-1" />
                              Draft
                            </Badge>
                          </div>
                          <CardTitle className="text-base font-semibold break-all break-words">
                            {announcement.title}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {announcement.content}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-dashed">
                          <span className="text-[10px] text-muted-foreground">
                            Terakhir diedit: {format(new Date(announcement.updated_at), "d MMM, HH:mm", { locale: idLocale })}
                          </span>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleEdit(announcement)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingAnnouncement(announcement)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Hapus
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {publishedAnnouncements.length > 0 && (
              <div className="space-y-3">
                {canManageContent() && draftAnnouncements.length > 0 && (
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Dipublikasikan
                  </h2>
                )}
                {publishedAnnouncements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className="group cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200"
                      onClick={() => navigate(`/announcements/${announcement.id}`)}
                    >
                      <CardHeader className="p-4 flex-row items-center justify-between space-y-0">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 h-5 px-1.5 text-[10px] border-none">
                              <Eye className="w-3 h-3 mr-1" />
                              Warga
                            </Badge>
                          </div>
                          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors break-all break-words">
                            {announcement.title}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex gap-4">
                          {announcement.image_url && (
                            <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden border">
                              <img
                                src={announcement.image_url}
                                alt={announcement.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {announcement.content}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <CardDescription className="text-[11px]">
                                {announcement.published_at &&
                                  format(
                                    new Date(announcement.published_at),
                                    "d MMM yyyy",
                                    { locale: idLocale }
                                  )}
                              </CardDescription>
                            </div>
                          </div>
                        </div>

                        {canManageContent() && (
                          <div className="mt-4 pt-3 border-t flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => handleEdit(announcement)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingAnnouncement(announcement)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Hapus
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {totalPages > 0 && (
              <div className="flex flex-col gap-4 sm:flex-row items-center justify-between mt-4">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select
                    defaultValue={String(DEFAULT_ITEMS_PER_PAGE)}
                    value={String(itemsPerPage)}
                    onValueChange={handleLimitChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEMS_PER_PAGE_OPTIONS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-1 items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button
                        variant={"default"}
                        size="sm"
                        className="w-8 h-8 p-0"
                      >
                        {currentPage}
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!deletingAnnouncement}
        onOpenChange={(open) => !open && setDeletingAnnouncement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pengumuman "
              <span className="font-semibold break-all">
                {deletingAnnouncement?.title}
              </span>
              "? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingAnnouncement) {
                  deleteMutation.mutate(deletingAnnouncement.id);
                  setDeletingAnnouncement(null);
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
