import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { EventHousePayment } from "@/types/database";

export function useEventHousePayments(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-house-payments", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_house_payments")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return (data || []) as EventHousePayment[];
    },
    enabled: !!eventId,
  });
}

export function useMarkEventHousePaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { event_id: string; house_id: string; amount?: number | null; notes?: string | null }) => {
      const { error } = await supabase
        .from("event_house_payments")
        .upsert(
          {
            event_id: data.event_id,
            house_id: data.house_id,
            amount: data.amount ?? null,
            notes: data.notes ?? null,
            marked_by: user?.id ?? null,
          },
          { onConflict: "event_id,house_id" }
        );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event-house-payments", data.event_id] });
      toast({ title: "Berhasil", description: "Pembayaran rumah ditandai lunas" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    },
  });
}

export function useUnmarkEventHousePaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { event_id: string; house_id: string }) => {
      const { error } = await supabase
        .from("event_house_payments")
        .delete()
        .eq("event_id", data.event_id)
        .eq("house_id", data.house_id);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event-house-payments", data.event_id] });
      toast({ title: "Berhasil", description: "Pembayaran rumah dibatalkan" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Gagal", description: err.message });
    },
  });
}
