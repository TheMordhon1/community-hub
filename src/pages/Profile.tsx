import { useState } from "react";
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
import { Loader2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <section className="p-6">
      <div className="mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold">Profil Saya</h1>
          <p className="text-muted-foreground">Kelola informasi akun Anda</p>
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
                <div className="flex-shrink-0">
                  <Avatar className="w-20 h-20">
                    {profile?.avatar_url ? (
                      <AvatarImage
                        src={profile.avatar_url}
                        alt={profile.full_name}
                      />
                    ) : (
                      <AvatarFallback className="text-2xl">
                        {profile?.full_name?.charAt(0) ?? "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
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
