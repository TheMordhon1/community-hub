import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  platform: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmergencyContacts() {
  return useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as EmergencyContact[];
    },
  });
}

export function useActiveEmergencyContacts() {
  return useQuery({
    queryKey: ["emergency-contacts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as EmergencyContact[];
    },
  });
}

export function useCreateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: Omit<EmergencyContact, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .insert(contact)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast.success("Kontak darurat berhasil ditambahkan");
    },
    onError: (error) => {
      toast.error("Gagal menambahkan kontak darurat: " + error.message);
    },
  });
}

export function useUpdateEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmergencyContact> & { id: string }) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast.success("Kontak darurat berhasil diperbarui");
    },
    onError: (error) => {
      toast.error("Gagal memperbarui kontak darurat: " + error.message);
    },
  });
}

export function useDeleteEmergencyContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("emergency_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency-contacts"] });
      toast.success("Kontak darurat berhasil dihapus");
    },
    onError: (error) => {
      toast.error("Gagal menghapus kontak darurat: " + error.message);
    },
  });
}

export const PLATFORM_OPTIONS = [
  { value: "phone", label: "Telepon", icon: "Phone" },
  { value: "whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { value: "telegram", label: "Telegram", icon: "Send" },
  { value: "email", label: "Email", icon: "Mail" },
];

export function getContactLink(platform: string, contact: string): string {
  switch (platform) {
    case "whatsapp":
      // Remove non-numeric chars except +

      return `https://wa.me/${contact
        .replace(/\D/g, "")
        .replace(/^0/, "+62")}`;
    case "telegram":
      return `https://t.me/${contact.replace("@", "")}`;
    case "email":
      return `mailto:${contact}`;
    case "phone":
    default:
      return `tel:${contact}`;
  }
}
