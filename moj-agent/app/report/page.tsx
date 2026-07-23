"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { FormEvent, ReactNode, useMemo, useState } from "react";

const examples = [
  "Rynek AI w Polsce — trendy, firmy, prognozy na 2026",
  "Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop",
  "Wpływ pracy zdalnej na produktywność — badania i statystyki",
  "Rynek nieruchomości w Krakowie — ceny, trendy, prognozy",
];

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
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
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

  const generate = (topic: string) => {
    const value = topic.trim();
    if (!value || isLoading) return;
    setCopied(false);
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
              <button
                type="button"
                onClick={() => void copyReport()}
                disabled={isLoading}
                className="rounded-lg border border-[#31535a] bg-[#10201e] px-4 py-2 text-sm font-semibold text-[#cffafe] transition hover:border-[#22d3ee] hover:bg-[#12302f] disabled:opacity-50"
              >
                {copied ? "✓ Skopiowano" : "📋 Kopiuj do schowka"}
              </button>
            </div>
            <div className="px-5 py-7 sm:px-8 sm:py-10">
              <ReportMarkdown content={report} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
