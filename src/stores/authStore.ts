import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, PengurusTitle, Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  pengurusTitle: PengurusTitle | null;
  hasFinanceAccess: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRole: (role: AppRole | null) => void;
  setPengurusTitle: (title: PengurusTitle | null) => void;
  setHasFinanceAccess: (hasAccess: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsInitialized: (initialized: boolean) => void;

  // Auth operations
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null; userId?: string }>;
  signOut: () => Promise<void>;

  // Data fetching
  fetchProfile: (userId: string) => Promise<void>;
  fetchRole: (userId: string) => Promise<void>;

  // Helpers
  isAdmin: () => boolean;
  isPengurus: () => boolean;
  isWarga: () => boolean;
  canManageContent: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  role: null,
  pengurusTitle: null,
  hasFinanceAccess: false,
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setRole: (role) => set({ role }),
  setPengurusTitle: (pengurusTitle) => set({ pengurusTitle }),
  setHasFinanceAccess: (hasFinanceAccess) => set({ hasFinanceAccess }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsInitialized: (isInitialized) => set({ isInitialized }),

  signIn: async (email, password) => {
    set({ isLoading: true });
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    set({ isLoading: false });
    return { error: error as Error | null };
  },

  signUp: async (email, password, fullName) => {
    set({ isLoading: true });
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    set({ isLoading: false });
    return { error: error as Error | null, userId: data?.user?.id };
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      role: null,
      pengurusTitle: null,
      hasFinanceAccess: false,
      isLoading: false,
    });
  },

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },

  fetchRole: async (userId) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, title_id, pengurus_titles(name, has_finance_access)')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      const titleData = data.pengurus_titles as { name: string; has_finance_access: boolean } | null;
      set({
        role: data.role as AppRole,
        pengurusTitle: titleData?.name as PengurusTitle | null,
        hasFinanceAccess: titleData?.has_finance_access ?? false
      });
    }
  },

  isAdmin: () => get().role === 'admin',
  isPengurus: () => get().role === 'pengurus',
  isWarga: () => get().role === 'warga',
  canManageContent: () => {
    const role = get().role;
    return role === 'admin' || role === 'pengurus';
  },
}));
