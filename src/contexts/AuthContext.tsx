import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata: any) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
      // Only update state on actual auth changes (sign in, sign out, user update)
      // Skip TOKEN_REFRESHED events to prevent unnecessary re-renders on tab switch
      if (event === 'TOKEN_REFRESHED') {
        // Just update session token silently without triggering re-renders
        setSession(prev => {
          // Only update if user ID is the same — avoids re-render cascades
          if (prev?.user?.id === newSession?.user?.id) {
            return newSession;
          }
          return prev;
        });
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: null, // Disable automatic email confirmation link, use OTP instead
        data: metadata,
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Log session end before signing out
    if (user && session) {
      try {
        // Find and update the login activity record for this session
        const { data: activities } = await supabase
          .from('login_activity')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('login_at', { ascending: false })
          .limit(1);

        if (activities && activities.length > 0) {
          await supabase
            .from('login_activity')
            .update({
              is_active: false,
              logout_at: new Date().toISOString(),
            })
            .eq('id', activities[0].id);

          // Update last_active_at in user profile
          await supabase
            .from('user_profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (err) {
        console.error('Error logging session end:', err);
        // Continue with logout even if logging fails
      }
    }

    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
