/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemoMode: boolean;
  authError: string | null;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | Error | null; user?: User | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | Error | null }>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Check existing session
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn('[Auth] Error fetching session:', error.message);
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setIsDemoMode(false); // real session terminates demo mode
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      const err = new Error('Supabase no está configurado. Por favor define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.');
      setAuthError(err.message);
      return { error: err };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthError(error.message);
        return { error };
      }

      setIsDemoMode(false);
      return { error: null };
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setAuthError(err.message);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      const err = new Error('Supabase no está configurado.');
      setAuthError(err.message);
      return { error: err };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setAuthError(error.message);
        return { error };
      }

      return { error: null, user: data.user };
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setAuthError(err.message);
      return { error: err };
    }
  };

  const signOut = async () => {
    setAuthError(null);
    setIsDemoMode(false);
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[Auth] Error signing out from Supabase:', e);
      }
    }
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      const err = new Error('Supabase no está configurado.');
      setAuthError(err.message);
      return { error: err };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        setAuthError(error.message);
        return { error };
      }

      return { error: null };
    } catch (e: any) {
      const err = e instanceof Error ? e : new Error(String(e));
      setAuthError(err.message);
      return { error: err };
    }
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setAuthError(null);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isDemoMode,
        authError,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        enterDemoMode,
        exitDemoMode,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
