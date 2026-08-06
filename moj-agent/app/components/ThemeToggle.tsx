"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Przełącz tryb jasny lub ciemny"
      title="Przełącz tryb jasny lub ciemny"
      className={`theme-toggle flex min-h-11 w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${className}`}
    >
      <span aria-hidden="true" className="grid h-8 w-10 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-base">
        <span className="theme-toggle__light">☀️</span>
        <span className="theme-toggle__dark">🌙</span>
      </span>
      <span className="theme-toggle__light">Tryb jasny</span>
      <span className="theme-toggle__dark">Tryb ciemny</span>
    </button>
  );
}
