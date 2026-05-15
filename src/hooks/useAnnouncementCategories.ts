import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnnouncementCategoryRow {
  id: string;
  name: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export function useAnnouncementCategories() {
  return useQuery({
    queryKey: ["announcement-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcement_categories")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as AnnouncementCategoryRow[];
    },
  });
}
