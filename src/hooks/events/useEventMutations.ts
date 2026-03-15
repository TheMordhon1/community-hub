import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Event, EventType } from "@/types/database";

export interface EventFormData {
  title: string;
  description: string;
  location: string;
  eventDate: Date | undefined;
  eventTime: string;
  eventType: EventType;
  imageFile: File | null;
  imagePreview: string | null;
}

export function useEventMutations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `events/${fileName}`;
    const { error } = await supabase.storage.from("event-images").upload(filePath, file);
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("event-images").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      location: string;
      event_date: string;
      event_time: string | null;
      image_url: string | null;
      event_type: EventType;
    }) => {
      const { error } = await supabase.from("events").insert({ ...data, author_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil dibuat" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membuat acara" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      title: string;
      description: string;
      location: string;
      event_date: string;
      event_time: string | null;
      image_url: string | null;
      event_type: EventType;
    }) => {
      const { id, ...rest } = data;
      const { error } = await supabase.from("events").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil diperbarui" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui acara" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Berhasil", description: "Acara berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus acara" });
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ eventId, isAttending }: { eventId: string; isAttending: boolean }) => {
      if (isAttending) {
        const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", user?.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: user?.id, status: "attending" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-rsvps"] });
    },
  });

  return { uploadImage, createMutation, updateMutation, deleteMutation, rsvpMutation };
}

// ── Event Form State Hook ─────────────────────────────────────────────────────
export function useEventForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState<Date>();
  const [eventTime, setEventTime] = useState("");
  const [eventType, setEventType] = useState<EventType>("regular");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setEventDate(undefined);
    setEventTime("");
    setEventType("regular");
    setImageFile(null);
    setImagePreview(null);
  };

  const populateForm = (event: Event) => {
    setTitle(event.title);
    setDescription(event.description || "");
    setLocation(event.location || "");
    setEventDate(new Date(event.event_date));
    setEventTime(event.event_time || "");
    setEventType(event.event_type || "regular");
    setImagePreview(event.image_url || null);
    setImageFile(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    title, setTitle,
    description, setDescription,
    location, setLocation,
    eventDate, setEventDate,
    eventTime, setEventTime,
    eventType, setEventType,
    imageFile,
    imagePreview,
    isUploading, setIsUploading,
    fileInputRef,
    resetForm,
    populateForm,
    handleImageChange,
    removeImage,
  };
}
