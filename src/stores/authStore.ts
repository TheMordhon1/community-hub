import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRole: (role: AppRole | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsInitialized: (initialized: boolean) => void;
  
  // Auth operations
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: Error | null }>;
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
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setRole: (role) => set({ role }),
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

  signUp: async (email, password, fullName, role) => {
    set({ isLoading: true });
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });
    set({ isLoading: false });
    return { error: error as Error | null };
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({
      user: null,
      session: null,
      profile: null,
      role: null,
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
      .select('role')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      set({ role: data.role as AppRole });
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
