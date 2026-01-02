import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface FinanceRecordInput {
  type: "income" | "outcome"
  amount: string
  description: string
  category: string
  transaction_date: string
}

export function useAddFinanceRecord() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (formData: FinanceRecordInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("User not authenticated")

      const { error } = await supabase.from("finance_records").insert({
        type: formData.type,
        amount: Number.parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        recorded_by: user.id,
        transaction_date: formData.transaction_date,
      })

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Catatan keuangan berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["finance-records"] })
    },
    onError: (error) => {
      console.error("Error adding finance record:", error)
      toast.error("Gagal menambahkan catatan keuangan")
    },
  })
}
