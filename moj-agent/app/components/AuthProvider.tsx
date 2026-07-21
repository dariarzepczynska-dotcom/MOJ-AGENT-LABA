"use client";

import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    void Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]).then(([userResult, sessionResult]) => {
      setState({ user: userResult.data.user ?? null, accessToken: sessionResult.data.session?.access_token ?? null, loading: false });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, accessToken: session?.access_token ?? null, loading: false });
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state.loading) return;
    if (!state.user && pathname !== "/login") router.replace("/login");
    if (state.user && pathname === "/login") router.replace("/");
  }, [pathname, router, state.loading, state.user]);

  if (state.loading || (!state.user && pathname !== "/login") || (state.user && pathname === "/login")) {
    return <div className="grid min-h-screen place-items-center bg-[#050506] text-[#9fb3ab]">Wczytywanie…</div>;
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
