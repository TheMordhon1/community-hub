import { useState, useRef, useEffect } from "react";

import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, PENGURUS_TITLE_LABELS, House, MemberType, MEMBER_TYPE_LABELS } from "@/types/database";
import {
  ArrowLeft,
  Home,
  Calendar as CalendarIcon,
  Info,
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  Save,
  X,
  Plus,
  Crown,
  Pencil,
  Loader2,
  Trash2,
  Camera,
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { getInitials } from "@/lib/utils";
import { useNaturalSort } from "@/hooks/useNaturalSort";

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
  house_id: z.string().min(1, "Pilih nomor rumah"),
});

const houseStatusSchema = z.object({
  occupancy_status: z.enum(["occupied", "empty"]),
  vacancy_reason: z.string().optional().or(z.literal("")),
  estimated_return_date: z.string().optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;
type HouseStatusForm = z.infer<typeof houseStatusSchema>;

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
      house_id: "",
    },
  });

  const { naturalSort } = useNaturalSort();

  const [isEditingHouse, setIsEditingHouse] = useState(false);
  const [isSavingHouse, setIsSavingHouse] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const houseForm = useForm<HouseStatusForm>({
    resolver: zodResolver(houseStatusSchema),
    defaultValues: {
      occupancy_status: "occupied",
      vacancy_reason: "",
      estimated_return_date: "",
    },
  });

  // Fetch user's house info
  const { data: userHouse } = useQuery({
    queryKey: ["user-house", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await (supabase
        .from("house_members")
        .select("*, houses(*)")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle());

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all houses for selection
  const { data: houses } = useQuery({
    queryKey: ["houses-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (error) throw error;
      return (data as House[]).sort((a, b) => {
        const blockSort = naturalSort(a.block, b.block);
        if (blockSort !== 0) return blockSort;
        return naturalSort(a.number, b.number);
      });
    },
  });

  const MEMBER_SORT_PRIORITY: Record<string, number> = {
    suami: 1,
    istri: 2,
    anak: 3,
    orang_tua: 4,
    saudara: 5,
    asisten: 6,
    single: 7,
  };

  // Fetch all house members
  const { data: houseMembers, isLoading: isMembersLoading } = useQuery({
    queryKey: ["house-members", userHouse?.house_id],
    queryFn: async () => {
      if (!userHouse?.house_id) return [];
      const { data: members, error } = await supabase
        .from("house_members")
        .select("*")
        .eq("house_id", userHouse.house_id)
        .eq("status", "approved")
        .order("is_head", { ascending: false })
        .order("full_name");

      if (error) throw error;

      const userIds = (members || [])
        .filter((m) => m.user_id)
        .map((m) => m.user_id as string);

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));
        return (members || []).map((m) => ({
          ...m,
          profiles: m.user_id ? profilesMap.get(m.user_id) : null,
        }));
      }

      return (members || []).map((m) => ({ ...m, profiles: null }));
    },
    enabled: !!userHouse?.house_id,
  });

  // Fetch pending join requests for THE USER (outgoing requests)
  const { data: myPendingRequests } = useQuery({
    queryKey: ["my-pending-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await (supabase
        .from("house_members")
        .select("*, houses(*)")
        .eq("user_id", user.id)
        .eq("status", "pending"));
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch pending join requests for THE HOUSE (incoming requests for KK)
  const { data: incomingRequests } = useQuery({
    queryKey: ["incoming-requests", userHouse?.house_id],
    queryFn: async () => {
      if (!userHouse?.house_id || !userHouse?.is_head) return [];
      const { data, error } = await supabase
        .from("house_members")
        .select("*")
        .eq("house_id", userHouse.house_id)
        .eq("status", "pending");
      if (error) throw error;
      return data;
    },
    enabled: !!userHouse?.house_id && !!userHouse?.is_head,
  });

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberType, setNewMemberType] = useState<MemberType | "">("");
  const [isSettingHead, setIsSettingHead] = useState(false);

  const addMemberMutation = useMutation({
    mutationFn: async ({ fullName, memberType }: { fullName: string; memberType: MemberType | null }) => {
      if (!userHouse?.house_id) return;
      
      const isAutoHead = memberType === "suami" || memberType === "single" || (houseMembers?.length === 0);
      
      const { error } = await supabase.from("house_members").insert({
        house_id: userHouse.house_id,
        full_name: fullName,
        member_type: memberType || null,
        is_head: isAutoHead,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      toast({ title: "Berhasil", description: "Anggota keluarga berhasil ditambahkan" });
      setIsAddingMember(false);
      setNewMemberName("");
      setNewMemberType("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menambah anggota keluarga" });
    },
  });

  const updateMemberStatusMutation = useMutation({
    mutationFn: async ({ memberId, memberType }: { memberId: string; memberType: MemberType }) => {
      const isAutoHead = memberType === "suami" || memberType === "single";
      
      const { error } = await supabase
        .from("house_members")
        .update({ 
          member_type: memberType,
          ...(isAutoHead ? { is_head: true } : {})
        })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      toast({ title: "Berhasil", description: "Status anggota keluarga diperbarui" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui status" });
    },
  });

  const setHeadMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("house_members")
        .update({ is_head: true })
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      toast({ title: "Berhasil", description: "Kepala keluarga berhasil diperbarui" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui kepala keluarga" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("house_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      toast({ title: "Berhasil", description: "Anggota keluarga berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus anggota keluarga" });
    },
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

  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // 1. Get the request details
      const { data: request, error: fetchErr } = await supabase
        .from("house_members")
        .select("*")
        .eq("id", requestId)
        .single();
      
      if (fetchErr) throw fetchErr;

      // 2. Remove old house member record for this user if it exists
      if (request.user_id) {
        // Find existing approved record for this user
        const { data: existingApproved } = await supabase
          .from("house_members")
          .select("id")
          .eq("user_id", request.user_id)
          .eq("status", "approved")
          .maybeSingle();
        
        if (existingApproved) {
          await supabase.from("house_members").delete().eq("id", existingApproved.id);
        }
      }

      // 3. Approve the new request
      const { error: approveErr } = await supabase
        .from("house_members")
        .update({ status: "approved" })
        .eq("id", requestId);
      
      if (approveErr) throw approveErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-requests"] });
      toast({ title: "Berhasil Setujui", description: "Anggota baru telah disetujui." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Gagal menyetujui", description: err.message });
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("house_members")
        .delete()
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-requests"] });
      toast({ title: "Permintaan Dihapus", description: "Permintaan bergabung telah dihapus." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Gagal menghapus", description: err.message });
    }
  });

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.id) return;

    setIsSaving(true);
    
    try {
      // 1. Update Profile (Name, Phone)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2. Handle House Move if house_id changed
      if (data.house_id !== userHouse?.house_id) {
        // Check if target house is empty
        const { data: targetMembers, error: checkError } = await supabase
          .from("house_members")
          .select("id, status, is_head")
          .eq("house_id", data.house_id)
          .eq("status", "approved");

        if (checkError) throw checkError;

        const isHouseEmpty = !targetMembers || targetMembers.length === 0;

        if (isHouseEmpty) {
          // Move directly and become KK
          // Remove old link
          if (userHouse?.id) {
            await supabase.from("house_members").delete().eq("id", userHouse.id);
          }
          
          // Add new link as approved head
          const { error: moveError } = await supabase
            .from("house_members")
            .insert({
              house_id: data.house_id,
              user_id: user.id,
              full_name: data.full_name,
              is_head: true,
              status: "approved"
            });
            
          if (moveError) throw moveError;
          toast({ title: "Berhasil Pindah Rumah", description: "Anda telah didaftarkan sebagai Kepala Keluarga di rumah baru." });
        } else {
          // Create a PENDING request
          // Don't delete old link yet! User stays in old house until approved.
          // First check if a pending request already exists for this house
          const { data: existingRequest } = await supabase
            .from("house_members")
            .select("id")
            .eq("house_id", data.house_id)
            .eq("user_id", user.id)
            .eq("status", "pending")
            .maybeSingle();

          if (!existingRequest) {
            const { error: reqError } = await supabase
              .from("house_members")
              .insert({
                house_id: data.house_id,
                user_id: user.id,
                full_name: data.full_name,
                is_head: false,
                status: "pending"
              });

            if (reqError) throw reqError;
            toast({ title: "Permintaan Pindah Dikirim", description: "Menunggu persetujuan dari Kepala Keluarga rumah tujuan." });
          } else {
            toast({ title: "Permintaan Sudah Ada", description: "Anda sudah memiliki permintaan bergabung yang sedang diproses untuk rumah ini." });
          }
        }
      }

      toast({
        title: "Profil disimpan",
        description: "Data profil berhasil diperbarui",
      });

      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-house"] });
      queryClient.invalidateQueries({ queryKey: ["house-members"] });
      queryClient.invalidateQueries({ queryKey: ["my-pending-requests"] });
    } catch (error) {
      console.error("Save profile error:", error);
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.message || "Terjadi kesalahan saat menyimpan profil",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onHouseSubmit = async (data: HouseStatusForm) => {
    if (!userHouse?.house_id) return;

    setIsSavingHouse(true);
    const { error } = await supabase
      .from("houses")
      .update({
        occupancy_status: data.occupancy_status,
        vacancy_reason: data.occupancy_status === "empty" ? data.vacancy_reason : null,
        estimated_return_date: data.occupancy_status === "empty" ? (data.estimated_return_date || null) : null,
      })
      .eq("id", userHouse.house_id);

    setIsSavingHouse(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: "Terjadi kesalahan saat menyimpan status rumah",
      });
      return;
    }

    toast({
      title: "Status rumah disimpan",
      description: "Data status rumah berhasil diperbarui",
    });

    setIsEditingHouse(false);
    queryClient.invalidateQueries({ queryKey: ["user-house"] });
  };

  const handleSetOccupied = async () => {
    if (!userHouse?.house_id) return;

    setIsSavingHouse(true);
    const { error } = await supabase
      .from("houses")
      .update({
        occupancy_status: "occupied",
        vacancy_reason: null,
        estimated_return_date: null,
      })
      .eq("id", userHouse.house_id);

    setIsSavingHouse(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: "Terjadi kesalahan saat menyimpan status rumah",
      });
      return;
    }

    toast({
      title: "Status rumah disimpan",
      description: "Anda telah kembali! Status rumah diperbarui menjadi Terisi",
    });

    queryClient.invalidateQueries({ queryKey: ["user-house"] });
  };

  const handleCancelHouse = () => {
    if (userHouse?.houses) {
      const house = userHouse.houses as House;
      houseForm.reset({
        occupancy_status: house.occupancy_status || "occupied",
        vacancy_reason: house.vacancy_reason || "",
        estimated_return_date: house.estimated_return_date || "",
      });
    }
    setIsEditingHouse(false);
  };

  // Set house form default values when userHouse is loaded
  useEffect(() => {
    if (userHouse?.houses) {
      const house = userHouse.houses as unknown as House;
      houseForm.reset({
        occupancy_status: house.occupancy_status || "occupied",
        vacancy_reason: house.vacancy_reason || "",
        estimated_return_date: house.estimated_return_date || "",
      });
      
      // Also update profile form with current house
      form.setValue("house_id", userHouse.house_id);
    }
  }, [userHouse, houseForm, form]);

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
        {myPendingRequests && myPendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 text-sm">Menunggu Persetujuan Pindah</h3>
                <p className="text-amber-700 text-xs mt-1">
                  Permintaan Anda untuk bergabung dengan <strong>Blok {(myPendingRequests[0].houses as unknown as House).block} No. {(myPendingRequests[0].houses as unknown as House).number}</strong> sedang menunggu persetujuan dari Kepala Keluarga tersebut.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 sm:h-8 text-xs border-amber-200 text-amber-700 hover:bg-amber-100 w-full sm:w-auto"
                    onClick={() => rejectRequestMutation.mutate(myPendingRequests[0].id)}
                    disabled={rejectRequestMutation.isPending}
                  >
                    Batalkan Permintaan
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
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

        {incomingRequests && incomingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <CardTitle className="text-base text-amber-900">Permintaan Bergabung</CardTitle>
                </div>
                <CardDescription className="text-xs text-amber-700">
                  Ada penghuni yang ingin bergabung dengan rumah Anda.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {incomingRequests.map((req) => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-white border border-amber-100 shadow-sm gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(req.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{req.full_name}</p>
                        <p className="text-[10px] text-muted-foreground italic">Ingin bergabung sebagai anggota keluarga</p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-50">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-9 sm:h-8 flex-1 sm:flex-none text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => rejectRequestMutation.mutate(req.id)}
                        disabled={rejectRequestMutation.isPending || approveRequestMutation.isPending}
                      >
                        Tolak
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-9 sm:h-8 flex-1 sm:flex-none text-xs bg-amber-600 hover:bg-amber-700"
                        onClick={() => approveRequestMutation.mutate(req.id)}
                        disabled={rejectRequestMutation.isPending || approveRequestMutation.isPending}
                      >
                        Setujui
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

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
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          <Label htmlFor="house_id">Blok/Nomor Rumah</Label>
                          <Select
                            value={form.watch("house_id")}
                            onValueChange={(value) => form.setValue("house_id", value)}
                          >
                            <SelectTrigger id="house_id">
                              <SelectValue placeholder="Pilih Nomor Rumah" />
                            </SelectTrigger>
                            <SelectContent>
                              {houses?.map((house) => (
                                <SelectItem key={house.id} value={house.id}>
                                  Blok {house.block} No. {house.number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground italic">
                            * Jika rumah tujuan sudah berpenghuni, kepindahan memerlukan persetujuan KK rumah tersebut.
                          </p>
                          {myPendingRequests && myPendingRequests.length > 0 && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 mt-2 transition-all">
                              <p className="text-[11px] sm:text-xs text-amber-800 font-medium flex items-center gap-1.5">
                                <Info className="w-3 h-3 flex-shrink-0" />
                                <span>Permintaan pending: Blok {(myPendingRequests[0].houses)?.block} No. {(myPendingRequests[0].houses)?.number}</span>
                              </p>
                            </div>
                          )}
                        </div>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{getHouseDisplay()}</p>
                          {myPendingRequests && myPendingRequests.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                              Pindah Pending
                            </Badge>
                          )}
                        </div>
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

        {userHouse?.houses && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Kelola Keluarga
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Atur anggota keluarga dan kepala keluarga
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddingMember(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Tambah
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {isMembersLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                    <div className="space-y-3">
                      {[...(houseMembers || [])]
                        .sort((a, b) => {
                          if (a.is_head !== b.is_head) return b.is_head ? 1 : -1;
                          const priorityA = MEMBER_SORT_PRIORITY[a.member_type || ""] || 99;
                          const priorityB = MEMBER_SORT_PRIORITY[b.member_type || ""] || 99;
                          if (priorityA !== priorityB) return priorityA - priorityB;
                          return (a.full_name || "").localeCompare(b.full_name || "");
                        })
                        .map((member, index) => (
                        <motion.div
                          key={member.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all gap-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-primary/10 shadow-sm shrink-0">
                              <AvatarImage src={member.profiles?.avatar_url || ""} />
                              <AvatarFallback className="bg-primary/5 text-primary text-xs sm:text-sm font-semibold">
                                {getInitials(member.profiles?.full_name || member.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="text-sm font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">
                                  {member.profiles?.full_name || member.full_name}
                                </span>
                                <div className="flex flex-wrap gap-1 font-bold">
                                  {member.is_head && (
                                    <Badge variant="secondary" className="px-1.5 h-4 sm:px-2 sm:h-5 text-[8px] sm:text-[9px] bg-amber-500/10 text-amber-600 border-amber-200/50 font-bold uppercase tracking-wider shadow-sm ring-1 ring-amber-500/20">
                                      <Crown className="w-2 sm:w-2.5 h-2 sm:h-2.5 mr-1" />
                                      KK
                                    </Badge>
                                  )}
                                  {member.member_type && (
                                    <Badge variant="outline" className="px-1.5 h-4 sm:px-2 sm:h-5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider shadow-sm">
                                      {MEMBER_TYPE_LABELS[member.member_type as MemberType]}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground font-medium truncate">
                                {member.user_id === user?.id ? "Profil Anda" : member.user_id ? "Terdaftar" : "Belum Punya Akun"}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 border-t sm:border-0 pt-3 sm:pt-0">
                            <Select
                              value={member.member_type || ""}
                              onValueChange={(value) => updateMemberStatusMutation.mutate({ memberId: member.id, memberType: value as MemberType })}
                            >
                              <SelectTrigger className="h-8 sm:h-9 w-[100px] sm:w-[120px] text-[9px] sm:text-[10px] font-bold">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(MEMBER_TYPE_LABELS).map(([value, label]) => {
                                  const isSuamiTaken = value === "suami" && houseMembers?.some(m => m.member_type === "suami" && m.id !== member.id);
                                  const isIstriTaken = value === "istri" && houseMembers?.some(m => m.member_type === "istri" && m.id !== member.id);
                                  const isSingleRestricted = value === "single" && (houseMembers?.length || 0) > 1;

                                  return (
                                    <SelectItem 
                                      key={value} 
                                      value={value} 
                                      className="text-[9px] sm:text-[10px]"
                                      disabled={isSuamiTaken || isIstriTaken || isSingleRestricted}
                                    >
                                      {label}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {!member.is_head && (!houseMembers?.some(m => m.member_type === "suami" || m.member_type === "single") || member.member_type === "suami" || member.member_type === "single") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 sm:h-9 text-[9px] sm:text-[10px] font-bold border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 transition-colors px-2 sm:px-3"
                                onClick={() => setHeadMutation.mutate(member.id)}
                                disabled={setHeadMutation.isPending}
                              >
                                <Crown className="w-3 sm:w-3.5 h-3 sm:h-3.5 mr-1.5" />
                                <span className="hidden xs:inline">Jadi KK</span>
                                <span className="xs:hidden">KK</span>
                              </Button>
                            )}
                            {!member.user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:bg-destructive/10 transition-all rounded-full"
                                onClick={() => {
                                  if (confirm(`Hapus ${member.full_name} dari anggota keluarga?`)) {
                                    removeMemberMutation.mutate(member.id);
                                  }
                                }}
                                disabled={removeMemberMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Dialog open={isAddingMember} onOpenChange={setIsAddingMember}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Anggota Keluarga</DialogTitle>
              <DialogDescription>
                Masukkan nama anggota keluarga yang tinggal di rumah ini.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="memberName">Nama Lengkap</Label>
                <Input
                  id="memberName"
                  placeholder="Contoh: Jane Doe"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && newMemberName.trim() && addMemberMutation.mutate({ fullName: newMemberName, memberType: (newMemberType || null) as MemberType | null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberType">Status Keluarga</Label>
                <Select
                  value={newMemberType}
                  onValueChange={(value: MemberType) => setNewMemberType(value)}
                >
                  <SelectTrigger id="memberType">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEMBER_TYPE_LABELS).map(([value, label]) => {
                      const isSuamiTaken = value === "suami" && houseMembers?.some(m => m.member_type === "suami");
                      const isIstriTaken = value === "istri" && houseMembers?.some(m => m.member_type === "istri");
                      const isSingleRestricted = value === "single" && (houseMembers?.length || 0) > 0;

                      return (
                        <SelectItem 
                          key={value} 
                          value={value}
                          disabled={isSuamiTaken || isIstriTaken || isSingleRestricted}
                        >
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingMember(false)}>
                Batal
              </Button>
              <Button
                disabled={!newMemberName.trim() || addMemberMutation.isPending}
                onClick={() => addMemberMutation.mutate({ fullName: newMemberName, memberType: (newMemberType || null) as MemberType | null })}
              >
                {addMemberMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Tambah Anggota
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {userHouse?.houses && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status Rumah</CardTitle>
                <CardDescription className="text-xs">Atur status hunian rumah Anda</CardDescription>
              </CardHeader>
              <CardContent>
                {isEditingHouse ? (
                  <form
                    onSubmit={houseForm.handleSubmit(onHouseSubmit)}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="occupancy_status">Status Hunian</Label>
                      <Select
                        value={houseForm.watch("occupancy_status")}
                        onValueChange={(value: "occupied" | "empty") =>
                          houseForm.setValue("occupancy_status", value)
                        }
                      >
                        <SelectTrigger id="occupancy_status">
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="occupied">Terisi (Ada Orang)</SelectItem>
                          <SelectItem value="empty">Kosong (Tidak Ada Orang)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {houseForm.watch("occupancy_status") === "empty" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="vacancy_reason">Alasan Kosong *</Label>
                          <Textarea
                            id="vacancy_reason"
                            {...houseForm.register("vacancy_reason")}
                            placeholder="Contoh: Mudik, Liburan, dsb"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="estimated_return_date">
                            Estimasi Tanggal Kembali
                          </Label>
                          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !houseForm.watch("estimated_return_date") &&
                                    "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {houseForm.watch("estimated_return_date") ? (
                                  format(
                                    new Date(
                                      houseForm.watch("estimated_return_date")!
                                    ),
                                    "d MMMM yyyy",
                                    { locale: idLocale }
                                  )
                                ) : (
                                  <span>Pilih tanggal</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={
                                  houseForm.watch("estimated_return_date")
                                    ? new Date(
                                        houseForm.watch("estimated_return_date")!
                                      )
                                    : undefined
                                }
                                onSelect={(date) => {
                                  houseForm.setValue(
                                    "estimated_return_date",
                                    date ? date.toISOString() : ""
                                  );
                                  setIsCalendarOpen(false);
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={isSavingHouse} size="sm">
                        {isSavingHouse && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelHouse}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Batal
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${
                      (userHouse.houses as House).occupancy_status === "empty"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        (userHouse.houses as House).occupancy_status === "empty"
                          ? "bg-red-500"
                          : "bg-green-500 animate-pulse"
                      }`} />
                      {(userHouse.houses as House).occupancy_status === "empty"
                        ? "Rumah Sedang Kosong"
                        : "Rumah Sedang Ditempati"}
                    </div>

                    {/* Vacancy info */}
                    {(userHouse.houses as House).occupancy_status === "empty" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-red-50/50 border border-red-100 rounded-xl">
                        <div className="flex items-start gap-3">
                          <div className="flex-none w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Info className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Alasan Kosong</p>
                            <p className="text-sm font-medium">
                              {(userHouse.houses as House).vacancy_reason || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex-none w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <CalendarIcon className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Estimasi Kembali</p>
                            <p className="text-sm font-medium">
                              {(userHouse.houses as House).estimated_return_date
                                ? format(
                                    new Date(
                                      (userHouse.houses as House).estimated_return_date!
                                    ),
                                    "dd MMMM yyyy",
                                    { locale: idLocale }
                                  )
                                : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons at bottom */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t">
                      {(userHouse.houses as House).occupancy_status === "empty" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSetOccupied}
                          disabled={isSavingHouse}
                          className="bg-green-600 hover:bg-green-700 gap-1.5 flex-1 sm:flex-none"
                        >
                          {isSavingHouse ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Home className="w-3.5 h-3.5" />
                          )}
                          Sudah Kembali
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 flex-1 sm:flex-none"
                        onClick={() => {
                          const house = userHouse.houses as House;
                          houseForm.reset({
                            occupancy_status: house.occupancy_status || "occupied",
                            vacancy_reason: house.vacancy_reason || "",
                            estimated_return_date: house.estimated_return_date || "",
                          });
                          setIsEditingHouse(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Status
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </section>
  );
}
