"use client";

import { usePathname } from "next/navigation";
import { AppNavigation } from "./AppNavigation";
import { AuthProvider } from "./AuthProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AuthProvider>
      {pathname !== "/login" && <AppNavigation />}
      <div className={pathname === "/login" ? "min-h-screen" : "app-theme min-h-screen bg-[var(--background)] pt-16 text-[var(--text-primary)] lg:pl-72 lg:pt-0"}>{children}</div>
    </AuthProvider>
  );
}
