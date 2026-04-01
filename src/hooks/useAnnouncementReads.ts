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
      queryClient.invalidateQueries({ queryKey: ["announcements", "count"] });
    },
  });

  return { readSet, markAsRead };
}

export interface ReaderProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  read_at: string;
}

export function useAnnouncementReaders(announcementId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["announcement-readers", announcementId],
    queryFn: async () => {
      if (!announcementId) return [];
      const { data, error } = await supabase
        .from("announcement_reads")
        .select("user_id, read_at")
        .eq("announcement_id", announcementId)
        .order("read_at", { ascending: false });
      if (error) throw error;

      if (data.length === 0) return [];

      const userIds = data.map((r) => r.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (profileError) throw profileError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]));

      return data.map((r) => ({
        user_id: r.user_id,
        full_name: profileMap.get(r.user_id)?.full_name || "Unknown User",
        avatar_url: profileMap.get(r.user_id)?.avatar_url || null,
        read_at: r.read_at,
      })) as ReaderProfile[];
    },
    enabled: !!announcementId && enabled,
  });
}
