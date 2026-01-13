import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export function useAnnouncementCount() {
  return useQuery({
    queryKey: ["announcements", "count"],
    queryFn: async () => {
      const { error, count } = await supabase
        .from("announcements")
        .select("*", { count: 'exact', head: true }); // head: true means "don't return rows"

      if (error) throw error;

      return count ?? 0;
    },
    refetchOnWindowFocus: false,
  });
}