"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

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
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) setError(result.error.message);
    else if (mode === "register" && !result.data.session) setMessage("Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
  }

  return <main className="grid min-h-screen place-items-center bg-[#050807] px-4 text-[#edf7f3]">
    <section className="w-full max-w-md rounded-2xl border border-[#263b34] bg-[#09110f] p-7 shadow-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#3dd6a3]">Mój Agent</p>
      <h1 className="mt-2 text-3xl font-bold">{mode === "login" ? "Zaloguj się" : "Utwórz konto"}</h1>
      <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-sm font-semibold">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-[#2f403b] bg-[#050a09] px-4 py-3 outline-none focus:border-[#3dd6a3]" /></label>
        <label className="block text-sm font-semibold">Hasło<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#2f403b] bg-[#050a09] px-4 py-3 outline-none focus:border-[#3dd6a3]" /></label>
        {error && <p className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
        {message && <p className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{message}</p>}
        <button disabled={loading} className="w-full rounded-xl bg-[#3dd6a3] px-5 py-3 font-bold text-[#04110d] disabled:opacity-50">{loading ? "Proszę czekać…" : mode === "login" ? "Zaloguj się" : "Zarejestruj się"}</button>
      </form>
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")} className="mt-5 w-full text-sm text-[#75e5bd]">{mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz konto? Zaloguj się"}</button>
    </section>
  </main>;
}
