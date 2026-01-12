import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { startOfToday } from "date-fns"

export function useUpcomingEventsCount() {
  return useQuery({
    queryKey: ["events", "upcoming", "count"],
    queryFn: async () => {
      const today = startOfToday().toISOString()

      const { data, error, count } = await supabase
        .from("events")
        .select("id", { count: "exact" })
        .gte("event_date", today)
        .order("event_date", { ascending: true })

      if (error) throw error
      return count ?? 0
    },
    refetchOnWindowFocus: false,
  })
}
