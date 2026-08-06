"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getValidAccessToken } from "@/lib/auth-fetch";

type AuthContextValue = { user: User | null; accessToken: string | null; loading: boolean };
const AuthContext = createContext<AuthContextValue>({ user: null, accessToken: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthContextValue>({ user: null, accessToken: null, loading: true });

  useEffect(() => {
    let isMounted = true;

    void getValidAccessToken().then(async (accessToken) => {
      if (!accessToken) {
        if (isMounted) setState({ user: null, accessToken: null, loading: false });
        return;
      }

      const { data, error } = await supabase.auth.getUser(accessToken);
      if (!isMounted) return;

      setState({
        user: error ? null : data.user ?? null,
        accessToken: error ? null : accessToken,
        loading: false,
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, accessToken: session?.access_token ?? null, loading: false });
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.loading) return;
    if (!state.user && pathname !== "/login") router.replace("/login");
    if (state.user && pathname === "/login") router.replace("/");
  }, [pathname, router, state.loading, state.user]);

  if (state.loading || (!state.user && pathname !== "/login") || (state.user && pathname === "/login")) {
    return <div className="grid min-h-screen place-items-center bg-[var(--background)] text-[var(--muted)]">Wczytywanie…</div>;
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
