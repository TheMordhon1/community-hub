import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface FinanceRecordUpdate {
  id: string
  type: "income" | "outcome"
  amount: string
  description: string
  category: string
  transaction_date: string
}

export function useUpdateFinanceRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FinanceRecordUpdate) => {
      const { error } = await supabase
        .from("finance_records")
        .update({
          type: formData.type,
          amount: Number.parseFloat(formData.amount),
          description: formData.description,
          category: formData.category,
          transaction_date: formData.transaction_date,
        })
        .eq("id", formData.id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Catatan keuangan berhasil diperbarui")
      queryClient.invalidateQueries({ queryKey: ["finance-records"] })
    },
    onError: (error) => {
      console.error("Error updating finance record:", error)
      toast.error("Gagal memperbarui catatan keuangan")
    },
  })
}
