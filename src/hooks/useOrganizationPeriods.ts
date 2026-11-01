import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type OrganizationPeriod = Tables<"organization_periods">;
export type PengurusTitle = Tables<"pengurus_titles">;

export interface PeriodMember {
  id: string;
  period_id: string;
  user_id: string;
  title_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  title_display_name: string;
  title_description: string | null;
  order_index: number;
}

export interface PeriodInput {
  name: string;
  start_year: number;
  end_year: number | null;
  notes?: string | null;
}

const KEYS = {
  periods: ["organization-periods"] as const,
  members: (periodId: string | null) => ["organization-period-members", periodId] as const,
};

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Terjadi kesalahan";

export { errorMessage as getPeriodErrorMessage };

/** Format "2026" or "2026 - 2027". */
export function formatPeriodYears(p: Pick<OrganizationPeriod, "start_year" | "end_year">): string {
  if (!p.end_year || p.end_year === p.start_year) return String(p.start_year);
  return `${p.start_year} - ${p.end_year}`;
}

export function useOrganizationPeriods() {
  return useQuery({
    queryKey: KEYS.periods,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_periods")
        .select("*")
        .order("start_year", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePengurusTitles() {
  return useQuery({
    queryKey: ["pengurus-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pengurus_titles")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePeriodMembers(periodId: string | null) {
  return useQuery({
    queryKey: KEYS.members(periodId),
    enabled: !!periodId,
    queryFn: async (): Promise<PeriodMember[]> => {
      if (!periodId) return [];
      const { data: members, error } = await supabase
        .from("organization_period_members")
        .select("*")
        .eq("period_id", periodId);
      if (error) throw error;
      if (!members.length) return [];

      const [{ data: profiles, error: pErr }, { data: titles, error: tErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, avatar_url").in("id", members.map((m) => m.user_id)),
        supabase.from("pengurus_titles").select("*"),
      ]);
      if (pErr) throw pErr;
      if (tErr) throw tErr;

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      const titleMap = new Map(titles.map((t) => [t.id, t]));

      return members
        .map((m): PeriodMember | null => {
          const profile = profileMap.get(m.user_id);
          const title = titleMap.get(m.title_id);
          if (!profile || !title) return null;
          return {
            id: m.id,
            period_id: m.period_id,
            user_id: m.user_id,
            title_id: m.title_id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            avatar_url: profile.avatar_url,
            title_display_name: title.display_name,
            title_description: title.description,
            order_index: title.order_index ?? 0,
          };
        })
        .filter((m): m is PeriodMember => m !== null)
        .sort((a, b) => a.order_index - b.order_index || a.full_name.localeCompare(b.full_name));
    },
  });
}

export function useAllProfiles(enabled: boolean) {
  return useQuery({
    queryKey: ["organization-all-profiles"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.periods });
    qc.invalidateQueries({ queryKey: ["organization-period-members"] });
    qc.invalidateQueries({ queryKey: ["organization-structure"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
}

export function useCreatePeriod() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ input, copyFromPeriodId }: { input: PeriodInput; copyFromPeriodId: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: period, error } = await supabase
        .from("organization_periods")
        .insert({ ...input, is_active: false, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;

      if (copyFromPeriodId) {
        const { data: src, error: srcErr } = await supabase
          .from("organization_period_members")
          .select("user_id, title_id")
          .eq("period_id", copyFromPeriodId);
        if (srcErr) throw srcErr;
        if (src.length) {
          const { error: insErr } = await supabase
            .from("organization_period_members")
            .insert(src.map((m) => ({ period_id: period.id, user_id: m.user_id, title_id: m.title_id })));
          if (insErr) throw insErr;
        }
      }
      return period;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePeriod() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: PeriodInput }) => {
      const { error } = await supabase.from("organization_periods").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePeriod() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organization_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useActivatePeriod() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("activate_organization_period", { _period_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useUpsertPeriodMember() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (input: { period_id: string; user_id: string; title_id: string }) => {
      const { error } = await supabase
        .from("organization_period_members")
        .upsert(input, { onConflict: "period_id,user_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRemovePeriodMember() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organization_period_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
