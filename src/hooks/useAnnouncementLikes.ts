import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface LikerProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  reaction_type: string;
}

export function useAnnouncementLikes(announcementIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reactionCounts = {} } = useQuery({
    queryKey: ["announcement-reaction-counts", announcementIds],
    queryFn: async () => {
      if (announcementIds.length === 0) return {};
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("announcement_id, reaction_type")
        .in("announcement_id", announcementIds);
      if (error) throw error;

      const counts: Record<string, Record<string, number>> = {};
      data.forEach((item) => {
        if (!counts[item.announcement_id]) {
          counts[item.announcement_id] = {};
        }
        const reactionType = item.reaction_type || 'heart';
        counts[item.announcement_id][reactionType] = (counts[item.announcement_id][reactionType] || 0) + 1;
      });
      return counts;
    },
    enabled: announcementIds.length > 0,
  });

  const { data: userReactions = new Set<string>() } = useQuery<Set<string>>({
    queryKey: ["announcement-user-reactions", user?.id, announcementIds],
    queryFn: async () => {
      if (!user || announcementIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("announcement_id, reaction_type")
        .eq("user_id", user.id)
        .in("announcement_id", announcementIds);
      if (error) throw error;
      return new Set(data.map((l) => `${l.announcement_id}:${l.reaction_type || 'heart'}`));
    },
    enabled: !!user && announcementIds.length > 0,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ announcementId, reactionType = 'heart' }: { announcementId: string; reactionType?: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const existingReactionKey = Array.from(userReactions).find(key => key.startsWith(`${announcementId}:`));
      const targetReactionKey = `${announcementId}:${reactionType}`;
      

      // Always delete any existing reaction first for this user/announcement
      // This ensures we only have one reaction at a time
      const { error: deleteError } = await supabase
        .from("announcement_likes")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", user.id);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      // If the clicked reaction is NOT the one we just removed, insert it as the new reaction
      if (existingReactionKey !== targetReactionKey) {
        const { error: insertError } = await supabase
          .from("announcement_likes")
          .insert({ 
            announcement_id: announcementId, 
            user_id: user.id,
            reaction_type: reactionType,
            created_at: new Date().toISOString()
          });
        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-reaction-counts"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-user-reactions"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-likers"] });
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast.error(`Gagal memperbarui reaksi: ${error.message || 'Error tidak diketahui'}`);
    }
  });

  return { reactionCounts, userReactions, toggleReaction };
}

export function useAnnouncementLikers(announcementId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["announcement-likers", announcementId],
    queryFn: async () => {
      if (!announcementId) return [];
      const { data, error } = await supabase
        .from("announcement_likes")
        .select("user_id, reaction_type")
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

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return data.map((l) => ({
        user_id: l.user_id,
        full_name: profileMap.get(l.user_id)?.full_name || "Unknown User",
        avatar_url: profileMap.get(l.user_id)?.avatar_url || null,
        reaction_type: l.reaction_type || 'heart',
      })) as LikerProfile[];
    },
    enabled: !!announcementId && enabled,
  });
}
