import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LikerProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

export function useAnnouncementLikes(announcementIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: likeCounts = {} } = useQuery({
    queryKey: ["announcement-like-counts", announcementIds],
    queryFn: async () => {
      if (announcementIds.length === 0) return {};
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("announcement_id")
        .in("announcement_id", announcementIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((like) => {
        counts[like.announcement_id] = (counts[like.announcement_id] || 0) + 1;
      });
      return counts;
    },
    enabled: announcementIds.length > 0,
  });

  const { data: userLikes = new Set<string>() } = useQuery({
    queryKey: ["announcement-user-likes", user?.id, announcementIds],
    queryFn: async () => {
      if (!user || announcementIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("announcement_id")
        .eq("user_id", user.id)
        .in("announcement_id", announcementIds);
      if (error) throw error;
      return new Set(data.map((l) => l.announcement_id));
    },
    enabled: !!user && announcementIds.length > 0,
  });

  const toggleLike = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) throw new Error("Not authenticated");
      const isLiked = userLikes.has(announcementId);
      if (isLiked) {
        const { error } = await supabase
          .from("announcement_likes")
          .delete()
          .eq("announcement_id", announcementId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcement_likes")
          .insert({ announcement_id: announcementId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-like-counts"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-user-likes"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-likers"] });
    },
  });

  return { likeCounts, userLikes, toggleLike };
}

export function useAnnouncementLikers(announcementId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["announcement-likers", announcementId],
    queryFn: async () => {
      if (!announcementId) return [];
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("user_id")
        .eq("announcement_id", announcementId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (data.length === 0) return [];

      const userIds = data.map((l) => l.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (profileError) throw profileError;

      return (profiles || []).map((p) => ({
        user_id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      })) as LikerProfile[];
    },
    enabled: !!announcementId && enabled,
  });
}
