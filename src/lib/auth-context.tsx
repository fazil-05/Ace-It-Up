import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Auth: Initializing...");

    // Handle OAuth redirect — Supabase puts tokens in the URL hash
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
          // Clean up the URL hash and redirect to dashboard
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setLoading(false);
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("Auth: Event fired:", event, "User:", s?.user?.email);
      setSession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      console.log("Auth: Current session fetched:", data.session ? "YES" : "NO");
      if (data.session) setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
