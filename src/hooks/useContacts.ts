import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContactMethod {
  platform: string;
  value: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  phones: string[];
  platform: string;
  methods: ContactMethod[];
  description: string | null;
  order_index: number;
  is_active: boolean;
  contact_type: "emergency" | "service";
  created_at: string;
  updated_at: string;
}

export const CONTACT_TYPE_OPTIONS = [
  { value: "emergency", label: "Darurat", icon: "Siren" },
  { value: "service", label: "Layanan", icon: "Wrench" },
] as const;


export const handleCopyContact = (phone: string) => {
  navigator.clipboard.writeText(phone);
  toast.success("Nomor telepon disalin!");
};

export function getContactMethods(
  contact: Pick<Contact, "phone" | "phones" | "platform" | "methods">
): ContactMethod[] {
  if (contact.methods && Array.isArray(contact.methods) && contact.methods.length > 0) {
    return contact.methods.filter((m) => m && m.value);
  }
  const list = contact.phones && contact.phones.length > 0 ? contact.phones : contact.phone ? [contact.phone] : [];
  return list.map((v) => ({ platform: contact.platform || "phone", value: v }));
}

export function getContactPhones(contact: Pick<Contact, "phone" | "phones">): string[] {
  if (contact.phones && contact.phones.length > 0) return contact.phones;
  return contact.phone ? [contact.phone] : [];
}

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as unknown as Contact[];
    },
  });
}

export function useActiveContacts() {
  return useQuery({
    queryKey: ["contacts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as unknown as Contact[];
    },
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contact: Omit<Contact, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .insert(contact as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Kontak berhasil ditambahkan");
    },
    onError: (error) => {
      toast.error("Gagal menambahkan kontak: " + error.message);
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Contact> & { id: string }) => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Kontak berhasil diperbarui");
    },
    onError: (error) => {
      toast.error("Gagal memperbarui kontak: " + error.message);
    },
  });
}

export function useDeleteContact() {
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
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Kontak berhasil dihapus");
    },
    onError: (error) => {
      toast.error("Gagal menghapus kontak: " + error.message);
    },
  });
}

export const PLATFORM_OPTIONS = [
  { value: "phone", label: "Telepon", icon: "Phone" },
  { value: "whatsapp", label: "WhatsApp", icon: "MessageCircle" },
  { value: "telegram", label: "Telegram", icon: "Send" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "instagram", label: "Instagram", icon: "Instagram" },
  { value: "facebook", label: "Facebook", icon: "Facebook" },
  { value: "twitter", label: "X / Twitter", icon: "Twitter" },
  { value: "tiktok", label: "TikTok", icon: "Music2" },
  { value: "youtube", label: "YouTube", icon: "Youtube" },
  { value: "linkedin", label: "LinkedIn", icon: "Linkedin" },
  { value: "website", label: "Website", icon: "Globe" },
];

export function getContactLink(platform: string, contact: string): string {
  const handle = contact.replace(/^@/, "").trim();
  switch (platform) {
    case "whatsapp": {
      const waNumber = contact.replace(/[^\d+]/g, "");
      return `https://wa.me/${waNumber.startsWith("+") ? waNumber.substring(1) : waNumber}`;
    }
    case "telegram":
      return `https://t.me/${handle}`;
    case "email":
      return `mailto:${contact}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "facebook":
      return contact.startsWith("http") ? contact : `https://facebook.com/${handle}`;
    case "twitter":
      return `https://x.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "youtube":
      return contact.startsWith("http") ? contact : `https://youtube.com/@${handle}`;
    case "linkedin":
      return contact.startsWith("http") ? contact : `https://linkedin.com/in/${handle}`;
    case "website":
      return contact.startsWith("http") ? contact : `https://${contact}`;
    case "phone":
    default:
      return `tel:${contact}`;
  }
}
