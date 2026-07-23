"use client";

import { FormEvent, useMemo, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

const exampleEmails = `Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł, a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło, ale nie dostaję maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`;

type Priority = "high" | "medium" | "low";

type EmailResult = {
  number: number;
  subject: string;
  category: string;
  priority: Priority;
  priorityLabel: string;
  reason: string;
  draft: string;
};

const priorityStyles: Record<Priority, string> = {
  high: "border-red-500/45 bg-red-500/[0.06]",
  medium: "border-amber-400/45 bg-amber-400/[0.06]",
  low: "border-emerald-400/40 bg-emerald-400/[0.05]",
};

function splitEmails(value: string) {
  return value
    .trim()
    .split(/\n\s*\n(?=(?:Od|From):\s)/i)
    .map((email) => email.trim())
    .filter(Boolean);
}

function tableValue(block: string, label: string) {
  const match = block.match(
    new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|\\n]+)\\s*\\|`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function parseResults(text: string): EmailResult[] {
  const starts = [...text.matchAll(/^### Mail\s+(\d+):\s*(.+)$/gim)];

  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? text.indexOf("## PODSUMOWANIE", start);
    const block = text.slice(start, end > start ? end : undefined);
    const priorityText = tableValue(block, "Priorytet");
    const draftMatch = block.match(
      /\*\*Proponowana odpowiedź:\*\*\s*\n((?:>\s?.*(?:\n|$))+)/i,
    );
    const draft =
      draftMatch?.[1]
        ?.split("\n")
        .map((line) => line.replace(/^>\s?/, "").trim())
        .filter(Boolean)
        .join(" ") ?? "";

    const priority: Priority = /wysoki/i.test(priorityText)
      ? "high"
      : /średni/i.test(priorityText)
        ? "medium"
        : "low";

    return {
      number: Number(match[1]),
      subject: match[2].trim(),
      category: tableValue(block, "Kategoria"),
      priority,
      priorityLabel: priorityText,
      reason: tableValue(block, "Uzasadnienie"),
      draft,
    };
  });
}

function getRecommendation(text: string) {
  return (
    text.match(/(?:✅\s*)?Rekomendacja:\s*(.+)/i)?.[1]?.trim() ?? ""
  );
}

export default function EmailTriagePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMail, setCopiedMail] = useState<number | null>(null);

  const cards = useMemo(() => parseResults(result), [result]);
  const counts = useMemo(
    () => ({
      high: cards.filter((card) => card.priority === "high").length,
      medium: cards.filter(
        (card) => card.priority === "medium" && !/spam/i.test(card.category),
      ).length,
      low: cards.filter(
        (card) => card.priority === "low" && !/spam/i.test(card.category),
      ).length,
      spam: cards.filter((card) => /spam/i.test(card.category)).length,
    }),
    [cards],
  );

  const analyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emails = splitEmails(input);
    if (!emails.length || isLoading) return;

    setError("");
    setResult("");
    setIsLoading(true);

    try {
      const response = await authFetch("/api/email-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Nie udało się przeanalizować maili.");
      }

      if (!response.body) throw new Error("Serwer nie zwrócił odpowiedzi.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Wystąpił nieoczekiwany błąd.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyDraft = async (card: EmailResult) => {
    await navigator.clipboard.writeText(card.draft);
    setCopiedMail(card.number);
    window.setTimeout(() => setCopiedMail(null), 1600);
  };

  return (
    <main className="min-h-screen bg-[#070a09] px-4 py-7 text-[#f4f7f5] sm:px-7 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 border-b border-[#20302b] pb-7">
          <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-[#3dd6a3]">
            Inteligentna skrzynka
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            📧 E-mail Triage
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9fb0aa] sm:text-base">
            Wklej maile — agent skategoryzuje je, ustali kolejność działania i
            przygotuje gotowe szkice odpowiedzi.
          </p>
        </header>

        <form onSubmit={analyze} className="rounded-2xl border border-[#263b34] bg-[#0b1210] p-4 shadow-2xl shadow-black/20 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="emails" className="text-sm font-semibold text-[#dce6e2]">
              Wiadomości do analizy
            </label>
            <button
              type="button"
              onClick={() => setInput(exampleEmails)}
              disabled={isLoading}
              className="rounded-lg border border-[#345149] bg-[#101d19] px-3 py-2 text-xs font-semibold text-[#bcd0c9] transition hover:border-[#3dd6a3] hover:text-white disabled:opacity-50"
            >
              📋 Wklej przykład
            </button>
          </div>
          <textarea
            id="emails"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wklej maile tutaj — oddziel je pustą linią..."
            disabled={isLoading}
            className="min-h-64 w-full resize-y rounded-xl border border-[#2b4039] bg-[#070c0a] px-4 py-4 font-mono text-sm leading-6 text-[#e6ece9] outline-none transition placeholder:text-[#53645e] focus:border-[#3dd6a3] focus:ring-2 focus:ring-[#3dd6a3]/10 disabled:opacity-70"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#71837c]">
              {input.trim() ? `${splitEmails(input).length} wykrytych wiadomości` : "Maksymalnie 20 wiadomości"}
            </span>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-[#3dd6a3] px-5 py-3 text-sm font-bold text-[#06100d] shadow-lg shadow-[#3dd6a3]/10 transition hover:bg-[#61e5b9] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isLoading ? "Analizuję skrzynkę…" : "📧 Analizuj maile"}
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {(cards.length > 0 || isLoading) && (
          <section aria-live="polite" className="mt-8">
            <div className="mb-5 rounded-2xl border border-[#2a4139] bg-[#0d1714] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#7d918a]">
                    Podsumowanie
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {isLoading && cards.length === 0
                      ? "Agent czyta wiadomości…"
                      : `${counts.high} pilne, ${counts.medium} średnie, ${counts.low} niskie, ${counts.spam} spam`}
                  </h2>
                </div>
                {isLoading && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#3dd6a3]/30 bg-[#3dd6a3]/10 px-3 py-1.5 text-xs text-[#85e8c6]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#3dd6a3]" />
                    Wynik napływa na żywo
                  </span>
                )}
              </div>
              {getRecommendation(result) && (
                <p className="mt-4 border-t border-[#24352f] pt-4 text-sm leading-6 text-[#c2d0cb]">
                  <span className="font-semibold text-[#3dd6a3]">Rekomendacja:</span>{" "}
                  {getRecommendation(result)}
                </p>
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {cards.map((card) => (
                <article
                  key={card.number}
                  className={`flex flex-col rounded-2xl border p-5 ${priorityStyles[card.priority]}`}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#82948d]">
                        Mail {card.number}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold leading-6">{card.subject}</h3>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold">
                      {card.priorityLabel || "Ocenianie…"}
                    </span>
                  </div>

                  <dl className="grid gap-3 py-4 text-sm">
                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                      <dt className="text-[#82948d]">Kategoria</dt>
                      <dd className="font-medium text-[#e5ece9]">{card.category || "Analizowanie…"}</dd>
                    </div>
                    <div className="grid grid-cols-[7rem_1fr] gap-3">
                      <dt className="text-[#82948d]">Uzasadnienie</dt>
                      <dd className="leading-5 text-[#c0cec9]">{card.reason || "Analizowanie…"}</dd>
                    </div>
                  </dl>

                  <div className="mt-auto rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a9bbb4]">
                        Proponowana odpowiedź
                      </p>
                      {card.draft && (
                        <button
                          type="button"
                          onClick={() => void copyDraft(card)}
                          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-[#d4dfdb] transition hover:border-[#3dd6a3] hover:text-white"
                        >
                          {copiedMail === card.number ? "Skopiowano ✓" : "Kopiuj draft"}
                        </button>
                      )}
                    </div>
                    <blockquote className="border-l-2 border-[#3dd6a3]/60 pl-3 text-sm leading-6 text-[#d7e0dc]">
                      {card.draft || "Draft jest właśnie przygotowywany…"}
                    </blockquote>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
