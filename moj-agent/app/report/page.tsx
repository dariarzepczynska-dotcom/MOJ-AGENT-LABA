"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../components/AuthProvider";

const examples = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

type SavedReport = {
  id: string;
  topic: string;
  content: string;
  created_at: string;
  updated_at: string;
};

function getMessageText(message?: UIMessage) {
  return (
    message?.parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : ""))
      .join("") ?? ""
  );
}

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*)/g);

  return tokens.map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) {
      return (
        <a
          key={`${token}-${index}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[#67e8f9] underline decoration-[#67e8f9]/40 underline-offset-4 hover:text-white"
        >
          {link[1]}
        </a>
      );
    }

    const bold = token.match(/^\*\*([^*]+)\*\*$/);
    return bold ? (
      <strong key={`${token}-${index}`} className="font-semibold text-white">
        {bold[1]}
      </strong>
    ) : (
      token
    );
  });
}

function ReportMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <article className="space-y-3 text-[15px] leading-7 text-[#cbd5e1]">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`space-${index}`} className="h-1" />;

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={index} className="pb-2 text-3xl font-bold tracking-tight text-white">
              {renderInline(trimmed.slice(2))}
            </h1>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="mt-8 border-b border-[#25414b] pb-2 text-xl font-semibold text-[#a5f3fc]"
            >
              {renderInline(trimmed.slice(3))}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={index} className="mt-5 text-lg font-semibold text-white">
              {renderInline(trimmed.slice(4))}
            </h3>
          );
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <div key={index} className="flex gap-3 pl-2">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#22d3ee]" />
              <p>{renderInline(trimmed.slice(2))}</p>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const number = trimmed.match(/^\d+/)?.[0];
          return (
            <div key={index} className="flex gap-3 pl-2">
              <span className="font-semibold text-[#67e8f9]">{number}.</span>
              <p>{renderInline(trimmed.replace(/^\d+\.\s/, ""))}</p>
            </div>
          );
        }

        return <p key={index}>{renderInline(trimmed)}</p>;
      })}
    </article>
  );
}

export default function ReportPage() {
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [reportTopic, setReportTopic] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/report" }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const reportMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const report = getMessageText(reportMessage);

  const loadSavedReports = useCallback(async () => {
    if (!user) return;

    setIsLoadingReports(true);
    setReportsError("");

    const { data, error: loadError } = await supabase
      .from("reports")
      .select("id, topic, content, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (loadError) {
      console.error("Nie udało się pobrać raportów z Supabase:", loadError);
      setReportsError(
        loadError.code === "42P01"
          ? "Tabela reports nie istnieje. Uruchom migrację migration_reports.sql."
          : "Nie udało się pobrać zapisanych raportów.",
      );
      setSavedReports([]);
    } else {
      setSavedReports((data ?? []) as SavedReport[]);
    }

    setIsLoadingReports(false);
  }, [user]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSavedReports();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSavedReports]);

  const generate = (topic: string) => {
    const value = topic.trim();
    if (!value || isLoading) return;
    setCopied(false);
    setReportTopic(value);
    setSaveState("idle");
    setSavedReportId(null);
    void sendMessage({ text: value });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    generate(input);
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const saveReport = async () => {
    if (!report || !reportTopic || !user || isLoading || saveState === "saving") {
      return;
    }

    setSaveState("saving");

    try {
      const { data: savedReport, error: saveError } = await supabase
        .from("reports")
        .insert({
          user_id: user.id,
          topic: reportTopic,
          content: report,
        })
        .select("id")
        .single();

      if (saveError) throw saveError;

      setSavedReportId(savedReport.id as string);
      setSaveState("saved");
      await loadSavedReports();
    } catch (saveError) {
      console.error("Nie udało się zapisać raportu w Supabase:", saveError);
      setSaveState("error");
    }
  };

  return (
    <main className="min-h-screen bg-[#050807] px-4 py-8 text-white sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="relative overflow-hidden rounded-3xl border border-[#214149] bg-[radial-gradient(circle_at_top_right,_#123c46_0,_#091312_40%,_#070b0a_75%)] px-6 py-10 shadow-2xl shadow-black/30 sm:px-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#22d3ee]/10 blur-3xl" />
          <p className="relative text-sm font-semibold uppercase tracking-[0.2em] text-[#67e8f9]">
            Research agent
          </p>
          <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            📊 Generator raportów
          </h1>
          <p className="relative mt-4 max-w-2xl text-base text-[#aebfbb] sm:text-lg">
            Opisz temat — agent napisze raport biznesowy
          </p>

          <form onSubmit={onSubmit} className="relative mt-8 flex flex-col gap-3 sm:flex-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Np. Rynek AI w Polsce w 2026 roku..."
              disabled={isLoading}
              className="min-w-0 flex-1 rounded-xl border border-[#31535a] bg-[#050a09]/80 px-5 py-4 text-white outline-none transition placeholder:text-[#637671] focus:border-[#22d3ee] focus:ring-4 focus:ring-[#22d3ee]/10 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-[#22d3ee] px-6 py-4 font-bold text-[#042026] transition hover:bg-[#67e8f9] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Analizuję..." : "📊 Generuj raport"}
            </button>
          </form>
        </header>

        <section className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#78918b]">
            Przykładowe tematy
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setInput(example);
                  generate(example);
                }}
                disabled={isLoading}
                className="rounded-xl border border-[#223a38] bg-[#09100f] px-4 py-3 text-left text-sm leading-6 text-[#b9cac6] transition hover:-translate-y-0.5 hover:border-[#22d3ee]/70 hover:bg-[#0b1919] hover:text-white disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </section>

        {isLoading && !report && (
          <section className="mt-8 rounded-2xl border border-[#20434a] bg-[#071315] p-8">
            <div className="flex items-center gap-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#22d3ee] border-t-transparent" />
              <div>
                <p className="font-semibold text-white">Agent prowadzi research</p>
                <p className="mt-1 text-sm text-[#8fa7a2]">
                  Szuka źródeł, porównuje dane i przygotowuje wnioski…
                </p>
              </div>
            </div>
          </section>
        )}

        {error && (
          <p className="mt-8 rounded-xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-red-200">
            Nie udało się wygenerować raportu: {error.message}
          </p>
        )}

        {report && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-[#27444a] bg-[#08100f] shadow-2xl shadow-black/25">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#203633] bg-[#0b1514] px-5 py-4 sm:px-7">
              <div>
                <p className="font-semibold text-white">Gotowy raport</p>
                <p className="text-xs text-[#78918b]">
                  {isLoading ? "Agent uzupełnia treść…" : "Research i analiza zakończone"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copyReport()}
                  disabled={isLoading}
                  className="rounded-lg border border-[#31535a] bg-[#10201e] px-4 py-2 text-sm font-semibold text-[#cffafe] transition hover:border-[#22d3ee] hover:bg-[#12302f] disabled:opacity-50"
                >
                  {copied ? "✓ Skopiowano" : "📋 Kopiuj do schowka"}
                </button>
                <button
                  type="button"
                  onClick={() => void saveReport()}
                  disabled={isLoading || saveState === "saving" || saveState === "saved"}
                  className="rounded-lg border border-[#3b634d] bg-[#102319] px-4 py-2 text-sm font-semibold text-[#bbf7d0] transition hover:border-[#4ade80] hover:bg-[#153522] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveState === "saving"
                    ? "Zapisywanie..."
                    : saveState === "saved"
                      ? "✓ Zapisano w bazie"
                      : "💾 Zapisz w bazie"}
                </button>
              </div>
            </div>
            {saveState === "error" && (
              <p className="border-b border-red-900/50 bg-red-950/30 px-5 py-3 text-sm text-red-200 sm:px-7">
                Nie udało się zapisać raportu. Sprawdź połączenie z Supabase i spróbuj ponownie.
              </p>
            )}
            {saveState === "saved" && savedReportId && (
              <p className="border-b border-emerald-900/50 bg-emerald-950/20 px-5 py-3 text-sm text-emerald-200 sm:px-7">
                Raport zapisano w dedykowanej bazie raportów.
              </p>
            )}
            <div className="px-5 py-7 sm:px-8 sm:py-10">
              <ReportMarkdown content={report} />
            </div>
          </section>
        )}

        <section className="mt-10 border-t border-[#203633] pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#67e8f9]">
                Biblioteka
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Zapisane raporty
              </h2>
              <p className="mt-2 text-sm text-[#8fa7a2]">
                Raporty zapisane na Twoim koncie w Supabase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSavedReports()}
              disabled={isLoadingReports}
              className="rounded-lg border border-[#31535a] px-4 py-2 text-sm font-semibold text-[#cffafe] transition hover:border-[#22d3ee] disabled:opacity-50"
            >
              {isLoadingReports ? "Odświeżanie…" : "↻ Odśwież"}
            </button>
          </div>

          {reportsError && (
            <p className="mt-5 rounded-xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-sm text-red-200">
              {reportsError}
            </p>
          )}

          {isLoadingReports && savedReports.length === 0 && (
            <div className="mt-5 rounded-xl border border-[#223a38] bg-[#09100f] px-5 py-8 text-center text-sm text-[#8fa7a2]">
              Wczytywanie zapisanych raportów…
            </div>
          )}

          {!isLoadingReports && !reportsError && savedReports.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-[#31504b] bg-[#09100f] px-5 py-10 text-center">
              <p className="font-semibold text-white">Nie masz jeszcze zapisanych raportów</p>
              <p className="mt-2 text-sm text-[#8fa7a2]">
                Wygeneruj raport i użyj przycisku „Zapisz w bazie”.
              </p>
            </div>
          )}

          {savedReports.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {savedReports.map((saved) => (
                <button
                  key={saved.id}
                  type="button"
                  onClick={() => setSelectedReport(saved)}
                  className="group rounded-xl border border-[#223a38] bg-[#09100f] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#22d3ee]/70 hover:bg-[#0b1919]"
                >
                  <p className="line-clamp-2 font-semibold leading-6 text-white">
                    {saved.topic}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#8fa7a2]">
                    {saved.content.replace(/[#*[\]()]/g, "").replace(/\s+/g, " ").trim()}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#718781]">
                      {new Intl.DateTimeFormat("pl-PL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(saved.created_at))}
                    </span>
                    <span className="font-semibold text-[#67e8f9] group-hover:text-white">
                      Otwórz raport →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedReport && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="saved-report-title"
            className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
            onClick={() => setSelectedReport(null)}
          >
            <div
              className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-[#27444a] bg-[#08100f] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#203633] bg-[#0b1514]/95 px-5 py-4 backdrop-blur sm:px-7">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#67e8f9]">
                    Zapisany raport
                  </p>
                  <h2 id="saved-report-title" className="mt-1 truncate font-semibold text-white">
                    {selectedReport.topic}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  aria-label="Zamknij raport"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#31535a] text-lg text-[#cffafe] transition hover:border-[#22d3ee] hover:bg-[#12302f]"
                >
                  ×
                </button>
              </div>
              <div className="px-5 py-7 sm:px-8 sm:py-10">
                <ReportMarkdown content={selectedReport.content} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
