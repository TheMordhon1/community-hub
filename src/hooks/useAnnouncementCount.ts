import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";

export function useAnnouncementCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Create a unique channel for this user's announcement count
    const channel = supabase
      .channel(`announcement_unread_count_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_reads',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log("Announcement read status changed, refreshing count...");
          queryClient.invalidateQueries({ queryKey: ["announcements", "count", user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcements'
        },
        () => {
          console.log("Announcements table changed, refreshing count...");
          queryClient.invalidateQueries({ queryKey: ["announcements", "count", user.id] });
        }
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status for unread count: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["announcements", "count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      // Get count of all published announcements
      const { count: totalPublished, error: totalError } = await supabase
        .from("announcements")
        .select("id", { count: 'exact', head: true })
        .eq("is_published", true);

      if (totalError) throw totalError;

      // Get count of announcements read by this user
      // We use !inner join to only count reads for announcements that are still published
      const { count: readCount, error: readError } = await supabase
        .from("announcement_reads")
        .select("id, announcements!inner(is_published)", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .eq("announcements.is_published", true);

      if (readError) throw readError;

      const unreadCount = (totalPublished ?? 0) - (readCount ?? 0);
      return Math.max(0, unreadCount);
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
  });
}