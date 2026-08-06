"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "../components/ThemeToggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
    setLoading(false);
    if (result.error) setError(result.error.message);
    else if (mode === "register" && !result.data.session) setMessage("Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
  }

  return <main className="relative grid min-h-screen place-items-center bg-[var(--background)] px-4 text-[var(--text-primary)]">
    <div className="absolute right-4 top-4 w-48"><ThemeToggle /></div>
    <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Mój Agent</p>
      <h1 className="mt-2 text-3xl font-bold">{mode === "login" ? "Zaloguj się" : "Utwórz konto"}</h1>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm font-semibold">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-[var(--text-primary)] outline-none placeholder:text-[var(--input-placeholder)] focus:border-[var(--focus-ring)]" /></label>
        <label className="block text-sm font-semibold">Hasło<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-[var(--text-primary)] outline-none placeholder:text-[var(--input-placeholder)] focus:border-[var(--focus-ring)]" /></label>
        {error && <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{error}</p>}
        {message && <p className="rounded-lg border border-[var(--success)] bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">{message}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Proszę czekać…" : mode === "login" ? "Zaloguj się" : "Zarejestruj się"}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">{mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz konto? Zaloguj się"}</button>
    </section>
  </main>;
}
