import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  // Ricorda l'ultima identità utente vista: evita di ricreare l'oggetto `user`
  // (e quindi di rimontare l'intero albero) sugli eventi TOKEN_REFRESHED / re-SIGNED_IN
  // che Supabase emette ogni ~5 min o al refocus della tab.
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // La sessione va sempre aggiornata: contiene il token fresco per le chiamate API.
        setSession(session);

        const newUserId = session?.user?.id ?? null;
        const identityChanged = newUserId !== lastUserIdRef.current;

        // Aggiorna `user` SOLO se l'identità è davvero cambiata (login/logout/switch).
        // Su un semplice refresh del token l'utente è lo stesso: non ricreare l'oggetto,
        // così i componenti montati (es. il wizard strategie) non vengono smontati.
        if (identityChanged) {
          lastUserIdRef.current = newUserId;
          setUser(session?.user ?? null);

          if (session?.user) {
            // Check if user is admin
            setTimeout(async () => {
              const { data } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .eq('role', 'admin')
                .maybeSingle();

              setIsAdmin(!!data);
            }, 0);
          } else {
            setIsAdmin(false);
          }
        }

        setLoading(false);
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      const initialUserId = session?.user?.id ?? null;
      // Imposta lo stato utente solo se il listener non l'ha già fatto per la stessa identità.
      if (initialUserId !== lastUserIdRef.current) {
        lastUserIdRef.current = initialUserId;
        setUser(session?.user ?? null);

        if (session?.user) {
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('role', 'admin')
            .maybeSingle()
            .then(({ data }) => {
              setIsAdmin(!!data);
            });
        }
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    const internalEmail = `${username.trim().toLowerCase()}@internal.local`;
    const { error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password,
    });
    
    // Invalida tutta la cache dopo login per forzare il refetch dei dati
    if (!error) {
      console.log('Login success - invalidating all query cache');
      await queryClient.invalidateQueries();
    }
    
    return { error };
  };

  const signOut = async () => {
    sessionStorage.removeItem('disclaimerAccepted');
    await supabase.auth.signOut();
    lastUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
