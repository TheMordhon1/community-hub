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
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setRole: (role: AppRole | null) => void;
  setPengurusTitle: (title: PengurusTitle | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsInitialized: (initialized: boolean) => void;

  // Auth operations
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, houseNumber?: string) => Promise<{ error: Error | null }>;
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
  isLoading: true,
  isInitialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setRole: (role) => set({ role }),
  setPengurusTitle: (pengurusTitle) => set({ pengurusTitle }),
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

  signUp: async (email, password, fullName, houseNumber) => {
    set({ isLoading: true });
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          house_number: houseNumber,
        },
      },
    });

    // If user was created, also upsert a profile row so it's available immediately
    try {
      const userId = data?.user?.id;
      if (userId) {
        // Detect whether the profiles table contains the `house_number` column.
        // This avoids PostgREST "PGRST204" errors when the migration hasn't been applied.
        let includeHouseNumber = false;
        try {
          await supabase.from('profiles').select('house_number').limit(1);
          includeHouseNumber = true;
        } catch (err: any) {
          // PGRST204 means PostgREST/cache doesn't know about the column yet.
          if (err?.code === 'PGRST204') {
            includeHouseNumber = false;
          } else {
            // For any other error, be conservative and skip the column to avoid blocking signup.
            includeHouseNumber = false;
          }
        }

        const payload: any = {
          id: userId,
          email,
          full_name: fullName,
        };

        if (includeHouseNumber) payload.house_number = houseNumber ?? null;

        await supabase.from('profiles').upsert(payload);
      }
    } catch (e) {
      // silently ignore profile upsert errors - signUp itself is authoritative
      console.error('Failed to upsert profile after signUp', e);
    }

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
      pengurusTitle: null,
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
      .select('role, title')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      set({
        role: data.role as AppRole,
        pengurusTitle: data.title as PengurusTitle | null
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
