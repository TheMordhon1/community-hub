import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Menu } from "@/types/menu";

export function useMenus() {
  return useQuery({
    queryKey: ["menus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function useSidebarMainMenus() {
  return useQuery({
    queryKey: ["menus", "sidebar-main"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_sidebar_main", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function useSidebarPengurusMenus() {
  return useQuery({
    queryKey: ["menus", "sidebar-pengurus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_sidebar_pengurus", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function useSidebarAdminMenus() {
  return useQuery({
    queryKey: ["menus", "sidebar-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_sidebar_admin", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function useQuickMenus() {
  return useQuery({
    queryKey: ["menus", "quick"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_quick_menu", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function usePengurusMenus() {
  return useQuery({
    queryKey: ["menus", "pengurus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_pengurus_menu", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}

export function useAdminMenus() {
  return useQuery({
    queryKey: ["menus", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .eq("show_in_admin_menu", true)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });
}
