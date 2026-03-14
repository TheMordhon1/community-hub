import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

export interface FinanceCategory {
  id: string
  name: string
  type: "income" | "outcome" | "donation" | "donation_outcome"
  created_by: string | null
  created_at: string
}

export function useFinanceCategories() {
  return useQuery({
    queryKey: ["finance-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("*")
        .order("name")
      if (error) throw error
      return data as FinanceCategory[]
    },
  })
}

export function useAddFinanceCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, type }: { name: string; type: "income" | "outcome" | "donation" | "donation_outcome" }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase.from("finance_categories").insert({
        name,
        type,
        created_by: user.id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Kategori berhasil ditambahkan")
      queryClient.invalidateQueries({ queryKey: ["finance-categories"] })
    },
    onError: (error) => {
      const customError = error as any;
      if (customError?.code === "23505") {
        toast.error("Kategori sudah ada")
      } else {
        toast.error("Gagal menambahkan kategori")
      }
    },
  })
}

export function useDeleteFinanceCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_categories").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Kategori berhasil dihapus")
      queryClient.invalidateQueries({ queryKey: ["finance-categories"] })
    },
    onError: () => {
      toast.error("Gagal menghapus kategori")
    },
  })
}
