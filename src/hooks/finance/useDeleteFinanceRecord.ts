import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export function useDeleteFinanceRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase.from("finance_records").delete().eq("id", recordId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Catatan keuangan berhasil dihapus")
      queryClient.invalidateQueries({ queryKey: ["finance-records"] })
    },
    onError: (error) => {
      console.error("Error deleting finance record:", error)
      toast.error("Gagal menghapus catatan keuangan")
    },
  })
}
