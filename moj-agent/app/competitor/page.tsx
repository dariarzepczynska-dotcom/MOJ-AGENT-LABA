"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { FormEvent, ReactNode, useMemo, useState } from "react";

const examples = [
  ["Shopify", "WooCommerce", "PrestaShop"],
  ["Notion", "Obsidian", "Evernote"],
  ["Vercel", "Netlify", "Railway"],
  ["ChatGPT", "Claude", "Gemini"],
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
  const tokens = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*)/g);

  return tokens.map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) {
      return (
        <a
          key={`${token}-${index}`}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-300 underline decoration-emerald-400/40 underline-offset-4 hover:text-white"
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

function parseRow(line: string) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function CompetitorMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (
      trimmed.startsWith("|") &&
      index + 1 < lines.length &&
      /^\|?[\s:|-]+\|[\s:|-]+/.test(lines[index + 1].trim())
    ) {
      const rows = [parseRow(trimmed)];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      index -= 1;

      elements.push(
        <div key={`table-${index}`} className="my-6 overflow-x-auto rounded-xl border border-[#29483e]">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[#153229] text-emerald-100">
              <tr>
                {rows[0].map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b border-[#365c4f] px-4 py-3 font-semibold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[#20382f] last:border-0 odd:bg-white/[0.015]">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-4 py-3 align-top ${cellIndex === 0 ? "font-semibold text-emerald-200" : "text-[#c8d5d0]"}`}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={`space-${index}`} className="h-1" />);
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={index} className="pb-2 text-3xl font-bold tracking-tight text-white">
          {renderInline(trimmed.slice(2))}
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={index} className="mt-8 border-b border-[#29483e] pb-2 text-xl font-semibold text-emerald-200">
          {renderInline(trimmed.slice(3))}
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={index} className="mt-5 text-lg font-semibold text-white">
          {renderInline(trimmed.slice(4))}
        </h3>,
      );
    } else if (/^[-*]\s/.test(trimmed)) {
      elements.push(
        <div key={index} className="flex gap-3 pl-2">
          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <p>{renderInline(trimmed.slice(2))}</p>
        </div>,
      );
    } else {
      elements.push(<p key={index}>{renderInline(trimmed)}</p>);
    }
  }

  return <article className="space-y-3 text-[15px] leading-7 text-[#c8d5d0]">{elements}</article>;
}

export default function CompetitorPage() {
  const [companies, setCompanies] = useState(["", "", ""]);
  const [context, setContext] = useState("");
  const [copied, setCopied] = useState(false);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/competitor" }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const resultMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const result = getMessageText(resultMessage);
  const isComplete = companies.every((company) => company.trim());

  const compare = (selectedCompanies = companies) => {
    if (isLoading || selectedCompanies.some((company) => !company.trim())) return;
    setCopied(false);
    const prompt = [
      `Porównaj firmy: ${selectedCompanies.map((company) => company.trim()).join(", ")}.`,
      context.trim() ? `Kontekst użytkownika: ${context.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    void sendMessage({ text: prompt });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    compare();
  };

  const chooseExample = (example: string[]) => {
    setCompanies(example);
    compare(example);
  };

  const copyAnalysis = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#050807] px-4 py-8 text-white sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="relative overflow-hidden rounded-3xl border border-[#25483b] bg-[radial-gradient(circle_at_top_right,_#194b3a_0,_#0b1813_42%,_#070b09_78%)] px-6 py-10 shadow-2xl shadow-black/30 sm:px-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
          <p className="relative text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Research agent
          </p>
          <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            🏢 Analiza konkurencji
          </h1>
          <p className="relative mt-4 max-w-2xl text-base text-[#afc2ba] sm:text-lg">
            Podaj firmy — agent porówna je za Ciebie
          </p>

          <form onSubmit={onSubmit} className="relative mt-8 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              {companies.map((company, index) => (
                <label key={index} className="space-y-2">
                  <span className="text-sm font-semibold text-emerald-100">Firma {index + 1}</span>
                  <input
                    value={company}
                    onChange={(event) =>
                      setCompanies((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    placeholder={["Np. Shopify", "Np. WooCommerce", "Np. PrestaShop"][index]}
                    disabled={isLoading}
                    className="w-full rounded-xl border border-[#36594d] bg-[#050a08]/80 px-4 py-3.5 text-white outline-none transition placeholder:text-[#667970] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-60"
                  />
                </label>
              ))}
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-emerald-100">Kontekst (opcjonalnie)</span>
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Szukam platformy e-commerce dla małego sklepu"
                rows={3}
                disabled={isLoading}
                className="w-full resize-y rounded-xl border border-[#36594d] bg-[#050a08]/80 px-4 py-3.5 text-white outline-none transition placeholder:text-[#667970] focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 disabled:opacity-60"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || !isComplete}
              className="rounded-xl bg-emerald-400 px-7 py-3.5 font-bold text-[#042017] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Analizuję..." : "🔍 Porównaj"}
            </button>
          </form>
        </header>

        <section className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#82998f]">
            Klikalne przykłady
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {examples.map((example) => (
              <button
                key={example.join("-")}
                type="button"
                onClick={() => chooseExample(example)}
                disabled={isLoading}
                className="rounded-xl border border-[#294239] bg-[#09110e] px-4 py-3 text-left text-sm text-[#bdcbc5] transition hover:-translate-y-0.5 hover:border-emerald-400/70 hover:bg-[#0d1b16] hover:text-white disabled:opacity-50"
              >
                {example.join(" vs ")}
              </button>
            ))}
          </div>
        </section>

        {isLoading && !result && (
          <section className="mt-8 rounded-2xl border border-[#285040] bg-[#081510] p-8">
            <div className="flex items-center gap-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <div>
                <p className="font-semibold">Agent analizuje konkurencję</p>
                <p className="mt-1 text-sm text-[#8fa69c]">
                  Zbiera źródła, porównuje ofertę i przygotowuje rekomendację…
                </p>
              </div>
            </div>
          </section>
        )}

        {error && (
          <p className="mt-8 rounded-xl border border-red-900/70 bg-red-950/30 px-5 py-4 text-red-200">
            Nie udało się przygotować analizy: {error.message}
          </p>
        )}

        {result && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-[#2b493e] bg-[#08100d] shadow-2xl shadow-black/25">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#243a32] bg-[#0b1612] px-5 py-4 sm:px-7">
              <div>
                <p className="font-semibold">Wynik porównania</p>
                <p className="text-xs text-[#81978e]">
                  {isLoading ? "Agent uzupełnia analizę…" : "Analiza i rekomendacja są gotowe"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyAnalysis()}
                disabled={isLoading}
                className="rounded-lg border border-[#36594d] bg-[#10231c] px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 hover:bg-[#153328] disabled:opacity-50"
              >
                {copied ? "✓ Skopiowano" : "📋 Kopiuj analizę"}
              </button>
            </div>
            <div className="px-5 py-7 sm:px-8 sm:py-10">
              <CompetitorMarkdown content={result} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
