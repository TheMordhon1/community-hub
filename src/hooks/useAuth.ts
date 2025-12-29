import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const {
    user,
    session,
    profile,
    role,
    pengurusTitle,
    isLoading,
    isInitialized,
    setUser,
    setSession,
    setIsLoading,
    setIsInitialized,
    fetchProfile,
    fetchRole,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isPengurus,
    isWarga,
    canManageContent,
  } = useAuthStore();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchRole(session.user.id);
          }, 0);
        }

        setIsLoading(false);
        setIsInitialized(true);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRole(session.user.id);
      }

      setIsLoading(false);
      setIsInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    session,
    profile,
    role,
    pengurusTitle,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isPengurus,
    isWarga,
    canManageContent,
  };
}
