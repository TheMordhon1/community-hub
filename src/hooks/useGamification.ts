import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UseQueryResult, UseMutationResult } from "@tanstack/react-query";
import { SupabaseClient } from "@supabase/supabase-js";
import { Profile } from "@/types/database";

// Use a simplified client type to avoid deep instantiation issues with the full Database type
const typedSupabase = supabase as unknown as SupabaseClient<Record<string, unknown>>;

export type GamificationRule = {
  id: string;
  action_key: string;
  action_name: string;
  points: number;
  description: string | null;
  is_active: boolean;
};

export type RewardItem = {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  reward_type: 'voucher' | 'ipl_discount' | 'physical_item';
  usage_limit: number;
};

export type PointRedemption = {
  id: string;
  user_id: string;
  reward_item_id: string;
  points_spent: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  redeem_code?: string;
  usage_count: number;
  usage_limit: number;
  created_at: string;
  used_at?: string;
  reward_item?: RewardItem;
  user_profile?: Profile;
};

export function useAllRedemptions() {
  return useQuery({
    queryKey: ["all-redemptions"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("point_redemptions")
        .select(`
          *,
          reward_item:reward_items(*),
          user_profile:profiles(*)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PointRedemption[];
    },
  });
}

export function useUpdateRedemptionStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string, status: PointRedemption['status'] }) => {
      const { error } = await typedSupabase
        .from("point_redemptions")
        .update({ status } as unknown as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["point-redemptions"] });
      toast({ title: "Berhasil", description: "Status penukaran diperbarui" });
    },
  });
}


export function useGamificationRules(): UseQueryResult<GamificationRule[], Error> {
  return useQuery({
    queryKey: ["gamification-rules"],
    queryFn: async () => {
      const response = await typedSupabase
        .from("gamification_rules")
        .select("*")
        .eq("is_active", true);
      
      if (response.error) throw response.error;
      return (response.data || []) as GamificationRule[];
    },
  });
}

export function useAwardPoints(): UseMutationResult<
  { points: number; action_name: string } | null,
  Error,
  { user_id: string; action_key: string }
> {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user_id, action_key }: { user_id: string; action_key: string }) => {
      // 1. Check if rule exists and get points
      const ruleResponse = (await typedSupabase
        .from("gamification_rules")
        .select("points, action_name")
        .eq("action_key", action_key)
        .eq("is_active", true)
        .single()) as unknown as { data: { points: number; action_name: string } | null; error: unknown };

      if (ruleResponse.error || !ruleResponse.data) return null;
      const rule = ruleResponse.data;

      // 2. Try to insert into history
      const historyResponse = await typedSupabase
        .from("user_point_history")
        .insert({
          user_id,
          action_key,
          points_awarded: rule.points,
        } as unknown as never);

      if (historyResponse.error) {
        if ((historyResponse.error as { code?: string }).code === "23505") {
          return null;
        }
        throw historyResponse.error;
      }

      // 3. Update user total points
      const profileResponse = (await typedSupabase
        .from("profiles")
        .select("points")
        .eq("id", user_id)
        .single()) as unknown as { data: { points: number } | null; error: unknown };

      if (profileResponse.error || !profileResponse.data) throw profileResponse.error;
      const profile = profileResponse.data;

      const newTotal = (profile.points || 0) + rule.points;

      const updateResponse = await typedSupabase
        .from("profiles")
        .update({ points: newTotal } as unknown as never)
        .eq("id", user_id);

      if (updateResponse.error) throw updateResponse.error;

      return { points: rule.points, action_name: rule.action_name };
    },
    onSuccess: (data) => {
      if (data) {
        toast({
          title: "Poin Berhasil Didapatkan!",
          description: `Kamu mendapatkan ${data.points} poin dari aksi: ${data.action_name}`,
        });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      }
    },
  });
}

export function useUpdateGamificationRule(): UseMutationResult<
  void,
  Error,
  Partial<GamificationRule> & { id: string }
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rule: Partial<GamificationRule> & { id: string }) => {
      const response = await typedSupabase
        .from("gamification_rules")
        .update(rule as unknown as never)
        .eq("id", rule.id);
      if (response.error) throw response.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-rules"] });
      toast({ title: "Berhasil", description: "Aturan poin diperbarui" });
    },
  });
}
export function useRewardItems(): UseQueryResult<RewardItem[], Error> {
  return useQuery({
    queryKey: ["reward-items"],
    queryFn: async () => {
      const response = await typedSupabase
        .from("reward_items")
        .select("*")
        .eq("is_active", true);
      if (response.error) throw response.error;
      return (response.data || []) as RewardItem[];
    },
  });
}

export function useRedeemPoint(): UseMutationResult<
  boolean,
  Error,
  { user_id: string; item_id: string; points_cost: number }
> {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ user_id, item_id, points_cost }: { user_id: string; item_id: string; points_cost: number }) => {
      // 1. Check user points
      const profileResponse = (await typedSupabase
        .from("profiles")
        .select("points")
        .eq("id", user_id)
        .single()) as unknown as { data: { points: number } | null; error: unknown };

      if (profileResponse.error || !profileResponse.data) throw profileResponse.error;
      const profile = profileResponse.data;

      if ((profile.points || 0) < points_cost) {
        throw new Error("Poin tidak cukup");
      }

      // 2. Create redemption record
      const redemptionResponse = await typedSupabase
        .from("point_redemptions")
        .insert({
          user_id,
          reward_item_id: item_id,
          points_spent: points_cost,
        } as unknown as never);

      if (redemptionResponse.error) throw redemptionResponse.error;

      // 3. Deduct points from user
      const updateResponse = await typedSupabase
        .from("profiles")
        .update({ points: (profile.points || 0) - points_cost } as unknown as never)
        .eq("id", user_id);

      if (updateResponse.error) throw updateResponse.error;

      return true;
    },
    onSuccess: () => {
      toast({ title: "Penukaran Berhasil", description: "Permintaan penukaran poin Anda sedang diproses" });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["point-redemptions"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    },
  });
}

export function useUpdateRewardItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Partial<RewardItem> & { id: string }) => {
      const { id, ...rest } = item;
      const { error } = await typedSupabase
        .from("reward_items")
        .update(rest as unknown as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward-items"] });
      toast({ title: "Berhasil", description: "Hadiah berhasil diperbarui" });
    },
  });
}

export function useCreateRewardItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<RewardItem, "id" | "created_at" | "updated_at">) => {
      const { error } = await typedSupabase
        .from("reward_items")
        .insert(item as unknown as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward-items"] });
      toast({ title: "Berhasil", description: "Hadiah baru ditambahkan" });
    },
  });
}

export function useGamificationEnabled() {
  return useQuery({
    queryKey: ["gamification-enabled"],
    queryFn: async () => {
      const { data, error } = await typedSupabase
        .from("app_settings")
        .select("value")
        .eq("key", "gamification_enabled")
        .single();
      if (error) return true; // Default to true if not found or error
      return (data as unknown as { value: boolean }).value === true;
    },
  });
}

export function useMyRedemptions(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-redemptions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await typedSupabase
        .from("point_redemptions")
        .select(`
          *,
          reward_item:reward_items(*)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PointRedemption[];
    },
    enabled: !!userId,
  });
}

export function useUpdateGamificationEnabled() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await typedSupabase
        .from("app_settings")
        .upsert({ 
          key: "gamification_enabled", 
          value: enabled as unknown as Record<string, unknown> 
        } as unknown as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gamification-enabled"] });
      toast({ title: "Berhasil", description: "Status gamifikasi diperbarui" });
    },
  });
}

export function useMyVouchers(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-vouchers", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await typedSupabase
        .from("point_redemptions")
        .select(`
          *,
          reward_item:reward_items(*)
        `)
        .eq("user_id", userId)
        .eq("status", "approved")
        .is("used_at", null);
      
      if (error) throw error;
      
      // Filter by reward_type 'voucher'
      return (data as PointRedemption[]).filter(r => r.reward_item?.reward_type === 'voucher');
    },
    enabled: !!userId,
  });
}

export function useMarkVoucherUsed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ redemptionId, storeId }: { redemptionId: string, storeId: string }) => {
      // First get current usage
      const { data: redemption, error: fetchErr } = await typedSupabase
        .from("point_redemptions")
        .select("usage_count, usage_limit")
        .eq("id", redemptionId)
        .single();
      
      if (fetchErr) throw fetchErr;

      const newCount = (redemption as unknown as { usage_count: number }).usage_count + 1;
      const limit = (redemption as unknown as { usage_limit: number }).usage_limit;
      
      const { error } = await typedSupabase
        .from("point_redemptions")
        .update({ 
          used_at: new Date().toISOString(),
          used_in_id: storeId,
          usage_count: newCount,
          status: newCount >= limit ? 'completed' : 'approved'
        } as unknown as never)
        .eq("id", redemptionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["point-redemptions"] });
    },
  });
}





