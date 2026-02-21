import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from "@/types/database";
import {
  Loader2,
  Pencil,
  Save,
  X,
  Camera,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { getInitials } from "@/lib/utils";

const profileSchema = z.object({
  full_name: z
    .string()
    .min(2, "Nama minimal 2 karakter")
    .max(100, "Nama terlalu panjang"),
  phone: z
    .string()
    .max(20, "Nomor telepon terlalu panjang")
    .optional()
    .or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function Profile() {
  const { profile, role, pengurusTitle, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    },
  });

  // Fetch user's house info
  const { data: userHouse } = useQuery({
    queryKey: ["user-house", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("house_residents")
        .select("*, houses(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const getRoleDisplay = () => {
    if (!role) return "User";
    if (role === "pengurus" && pengurusTitle)
      return PENGURUS_TITLE_LABELS[pengurusTitle];
    return ROLE_LABELS[role];
  };

  const getHouseDisplay = () => {
    if (!userHouse?.houses) return "-";
    const house = userHouse.houses as { block: string; number: string };
    return `Blok ${house.block} No. ${house.number}`;
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.id) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: "Terjadi kesalahan saat menyimpan profil",
      });
      return;
    }

    toast({
      title: "Profil disimpan",
      description: "Data profil berhasil diperbarui",
    });

    setIsEditing(false);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    window.location.reload();
  };

  const handleCancel = () => {
    form.reset({
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    });
    setIsEditing(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "File tidak valid",
        description: "Silakan pilih file gambar (JPG, PNG, dll)",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File terlalu besar",
        description: "Ukuran maksimal foto adalah 2MB",
      });
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Foto berhasil diperbarui",
        description: "Foto profil Anda telah diperbarui",
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      window.location.reload();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Gagal mengunggah foto",
        description: "Terjadi kesalahan saat mengunggah foto",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.id || !profile?.avatar_url) return;

    setIsRemovingPhoto(true);

    try {
      // Extract file path from URL
      const avatarUrl = profile.avatar_url;
      const pathMatch = avatarUrl.match(/avatars\/(.+)$/);

      if (pathMatch) {
        // Delete from storage
        await supabase.storage.from("avatars").remove([pathMatch[1]]);
      }

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Foto berhasil dihapus",
        description: "Foto profil Anda telah dihapus",
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      window.location.reload();
    } catch (error) {
      console.error("Remove photo error:", error);
      toast({
        variant: "destructive",
        title: "Gagal menghapus foto",
        description: "Terjadi kesalahan saat menghapus foto",
      });
    } finally {
      setIsRemovingPhoto(false);
    }
  };

  return (
    <section className="p-6">
      <div className="mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="font-display text-2xl font-bold">Profil Saya</h1>
              <p className="text-muted-foreground">
                Kelola informasi akun Anda
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Informasi Profil</CardTitle>
                <CardDescription>Data diri dan kontak</CardDescription>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 relative group">
                  <Avatar className="w-20 h-20">
                    {profile?.avatar_url ? (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={profile.full_name}
                      />
                    ) : (
                      <AvatarFallback className="text-2xl">
                        {getInitials(profile?.full_name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full shadow-md"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : profile?.avatar_url ? (
                      <Pencil className="w-4 h-4" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full shadow-md"
                      onClick={handleRemovePhoto}
                      disabled={isUploadingPhoto || isRemovingPhoto}
                    >
                      {isRemovingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="flex-1 space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nama Lengkap</Label>
                      <Input
                        id="full_name"
                        {...form.register("full_name")}
                        placeholder="Masukkan nama lengkap"
                      />
                      {form.formState.errors.full_name && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.full_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Nomor Telepon</Label>
                      <Input
                        id="phone"
                        {...form.register("phone")}
                        placeholder="Contoh: 08123456789"
                      />
                      {form.formState.errors.phone && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.phone.message}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={isSaving}>
                        {isSaving && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Batal
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-1">
                    <h2 className="text-lg font-medium">
                      {profile?.full_name ?? "-"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {getRoleDisplay()}
                    </p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium">{profile?.email ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Nomor Rumah
                        </p>
                        <p className="font-medium">{getHouseDisplay()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Telepon</p>
                        <p className="font-medium">{profile?.phone ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Bergabung
                        </p>
                        <p className="font-medium">
                          {profile?.created_at
                            ? new Date(profile.created_at).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
