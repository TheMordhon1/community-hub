import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAnnouncementReads(announcementIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: readSet = new Set<string>() } = useQuery({
    queryKey: ["announcement-reads", user?.id, announcementIds],
    queryFn: async () => {
      if (!user || announcementIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user.id)
        .in("announcement_id", announcementIds);
      if (error) throw error;
      return new Set(data.map((r) => r.announcement_id));
    },
    enabled: !!user && announcementIds.length > 0,
  });

  const markAsRead = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error("Not authenticated");
      if (readSet.has(announcementId)) return;
      const { error } = await supabase
        .from("announcement_reads")
        .upsert(
          { announcement_id: announcementId, user_id: user.id },
          { onConflict: "announcement_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-reads"] });
    },
  });

  return { readSet, markAsRead };
}
