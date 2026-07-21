"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const scenarios = [
  "Planuje weekend w Berlinie. Budzet: 2000 PLN",
  "Lece do Paryza na tydzien w sierpniu",
  "Wycieczka do Pragi z rodzina na 3 dni",
  "Podroz sluzbowa do Londynu w przyszlym tygodniu",
  "Porownaj Barcelone i Lizbone na wakacje",
];

const toolLabels: Record<string, { label: string; icon: string }> = {
  google_search: { label: "Google Search", icon: "G" },
  readWebPage: { label: "Strona WWW", icon: "WWW" },
  generateImage: { label: "Grafika", icon: "IMG" },
  calculator: { label: "Kalkulator", icon: "=" },
  currentDateTime: { label: "Data i czas", icon: "T" },
  getWeather: { label: "Pogoda", icon: "WX" },
  getExchangeRate: { label: "Waluta", icon: "FX" },
  getHolidays: { label: "Swieta", icon: "CAL" },
  searchWikipedia: { label: "Wikipedia", icon: "W" },
  saveNote: { label: "Zapis notatki", icon: "N+" },
  getNotes: { label: "Notatki", icon: "N" },
};

const sectionCards: Record<string, { title: string; icon: string; className: string }> = {
  podsumowanie: {
    title: "Podsumowanie",
    icon: "MAP",
    className: "border-[#3b82f6] bg-[#0b1730]",
  },
  pogoda: {
    title: "Pogoda",
    icon: "WX",
    className: "border-[#38bdf8] bg-[#062332]",
  },
  budzet: {
    title: "Budzet",
    icon: "PLN",
    className: "border-[#22c55e] bg-[#082516]",
  },
  "wazne daty": {
    title: "Wazne daty",
    icon: "CAL",
    className: "border-[#f59e0b] bg-[#2a1906]",
  },
  "co zobaczyc": {
    title: "Co zobaczyc",
    icon: "PIN",
    className: "border-[#a78bfa] bg-[#1d1438]",
  },
  "checklist przed wyjazdem": {
    title: "Checklist przed wyjazdem",
    icon: "OK",
    className: "border-[#14b8a6] bg-[#062522]",
  },
};

type AnyPart = UIMessage["parts"][number] & {
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  toolName?: string;
};

type PlanSection = {
  title: string;
  content: string;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("");
}

function isToolPart(part: UIMessage["parts"][number]) {
  return part.type.startsWith("tool-") || part.type === "dynamic-tool";
}

function getToolName(part: AnyPart) {
  if (part.type === "dynamic-tool") {
    return part.toolName ?? "tool";
  }

  return part.type.replace(/^tool-/, "");
}

function compact(value: unknown, maxLength = 180) {
  if (value === undefined || value === null) {
    return "";
  }

  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 0) ?? "";

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function summarizeToolOutput(toolName: string, output: unknown, errorText?: string) {
  if (errorText) {
    return errorText;
  }

  if (!output || typeof output !== "object") {
    return compact(output) || "wykonano";
  }

  const record = output as Record<string, unknown>;

  if (typeof record.error === "string") {
    return record.error;
  }

  if (toolName === "getWeather") {
    return `${record.city}: ${record.temperature} C, ${record.description}, wiatr ${record.windSpeed} km/h`;
  }

  if (toolName === "getExchangeRate") {
    return `1 ${record.currency} = ${record.rate} PLN, data ${record.date}`;
  }

  if (toolName === "getHolidays" && Array.isArray(record.holidays)) {
    return `${record.countryCode}: ${record.holidays.length} swiat w ${record.year}`;
  }

  if (toolName === "searchWikipedia") {
    return `${record.title}: ${compact(record.summary, 130)}`;
  }

  if (toolName === "calculator" && "result" in record) {
    return `wynik: ${record.result}`;
  }

  if (toolName === "currentDateTime" && typeof record.dateTime === "string") {
    return record.dateTime;
  }

  if (toolName === "google_search") {
    return "wyniki wyszukiwania gotowe";
  }

  return compact(output);
}

function getToolParts(message?: UIMessage) {
  return message?.parts.filter(isToolPart).map((part) => part as AnyPart) ?? [];
}

function hasToolError(part: AnyPart) {
  if (part.errorText) {
    return true;
  }

  return (
    !!part.output &&
    typeof part.output === "object" &&
    typeof (part.output as Record<string, unknown>).error === "string"
  );
}

function getToolError(part: AnyPart) {
  if (part.errorText) {
    return part.errorText;
  }

  if (part.output && typeof part.output === "object") {
    const error = (part.output as Record<string, unknown>).error;
    return typeof error === "string" ? error : "";
  }

  return "";
}

function formatElapsed(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function DiagnosticsPanel({
  toolParts,
  elapsedMs,
  isLoading,
  hasAssistant,
}: {
  toolParts: AnyPart[];
  elapsedMs: number;
  isLoading: boolean;
  hasAssistant: boolean;
}) {
  const stepCount = Math.min(toolParts.length, 5);
  const progressColor =
    stepCount >= 5 ? "bg-[#ef4444]" : stepCount === 4 ? "bg-[#f59e0b]" : "bg-[#22c55e]";
  const toolCounts = toolParts.reduce<Record<string, number>>((counts, part) => {
    const toolName = getToolName(part);
    counts[toolName] = (counts[toolName] ?? 0) + 1;
    return counts;
  }, {});
  const errors = toolParts
    .filter(hasToolError)
    .map((part) => ({
      toolName: getToolName(part),
      input: compact(part.input, 80),
      error: getToolError(part),
    }));
  const statusText = isLoading
    ? stepCount >= 5
      ? "Limit krokow"
      : "W trakcie..."
    : hasAssistant
      ? "Ukonczone"
      : "Oczekuje";
  const statusIcon = statusText === "Limit krokow" ? "!" : statusText === "Ukonczone" ? "OK" : "...";
  const toolSummary = Object.entries(toolCounts)
    .map(([name, count]) => `${name}(${count})`)
    .join(", ");

  return (
    <section className="border-t border-[#223047] bg-[#0d121a] px-4 py-4 sm:px-5">
      <div className="rounded-lg border border-[#31445e] bg-[#0b111a] p-4">
        <h3 className="text-sm font-semibold text-[#dbeafe]">Diagnostyka</h3>
        <div className="mt-3 space-y-3 text-sm text-[#cbd5e1]">
          <div>
            <div className="flex items-center justify-between">
              <span>Kroki</span>
              <span>{stepCount}/5</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-[#1e293b]">
              <div
                className={`h-full rounded transition-all ${progressColor}`}
                style={{ width: `${(stepCount / 5) * 100}%` }}
              />
            </div>
          </div>
          <p>Narzedzia: {toolSummary || "brak"}</p>
          <p>Bledy: {errors.length}</p>
          <p>Czas: {formatElapsed(elapsedMs)}</p>
          <p>Status: {statusIcon} {statusText}</p>
          {errors.length > 0 && (
            <div className="space-y-2">
              {errors.map((item, index) => (
                <div
                  key={`${item.toolName}-${index}`}
                  className="rounded border border-[#7f1d1d] bg-[#2a0d0d] px-3 py-2 text-[#fecaca]"
                >
                  {item.toolName}({item.input}) - {item.error}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function parsePlan(text: string) {
  const planTitle = text.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? "Plan podrozy";
  const headingRegex = /^###\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRegex)];

  if (matches.length === 0) {
    return {
      title: planTitle,
      sections: text.trim() ? [{ title: "Plan", content: text.trim() }] : [],
    };
  }

  return {
    title: planTitle,
    sections: matches.map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end =
        index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;

      return {
        title: match[1].trim(),
        content: text.slice(start, end).trim(),
      };
    }),
  };
}

function getSectionConfig(title: string) {
  const normalized = title.toLowerCase().replace(/[^\p{L}\s]/gu, "").trim();

  return (
    sectionCards[normalized] ?? {
      title,
      icon: "AI",
      className: "border-[#334155] bg-[#111827]",
    }
  );
}

function renderInlineMarkdown(line: string) {
  return line
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n").filter((line) => line.trim());
  const tableLines = lines.filter((line) => line.trim().startsWith("|"));
  const hasTable = tableLines.length >= 2;

  if (hasTable) {
    const rows = tableLines
      .filter((line) => !/^\|\s*-/.test(line))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => renderInlineMarkdown(cell)),
      );

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row.join("-")}-${rowIndex}`} className="border-b border-white/10">
                {row.map((cell, cellIndex) => {
                  const Tag = rowIndex === 0 ? "th" : "td";

                  return (
                    <Tag
                      key={`${cell}-${cellIndex}`}
                      className="px-3 py-2 text-left align-top"
                    >
                      {cell}
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-[#dbe7f3]">
      {lines.map((line, index) => {
        const isListItem = /^\s*[-*]\s+/.test(line);

        return (
          <p key={`${line}-${index}`} className={isListItem ? "pl-3" : ""}>
            {isListItem ? <span className="mr-2 text-[#93c5fd]">-</span> : null}
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function PlanCard({ section }: { section: PlanSection }) {
  const config = getSectionConfig(section.title);

  return (
    <section className={`rounded-lg border p-4 shadow-lg shadow-black/15 ${config.className}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 min-w-9 place-items-center rounded bg-white/10 px-1 text-[11px] font-bold text-white">
          {config.icon}
        </span>
        <h3 className="text-lg font-semibold text-white">{config.title}</h3>
      </div>
      <MarkdownContent content={section.content} />
    </section>
  );
}

function ToolTimeline({ message }: { message: UIMessage }) {
  const toolParts = message.parts.filter(isToolPart).map((part) => part as AnyPart);

  if (toolParts.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {toolParts.map((part, index) => {
        const toolName = getToolName(part);
        const config = toolLabels[toolName] ?? { label: toolName, icon: "API" };
        const running =
          part.state === "input-streaming" || part.state === "input-available";

        return (
          <div
            key={part.toolCallId ?? `${part.type}-${index}`}
            className="rounded-lg border border-[#31445e] bg-[#0b111a] p-3"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="grid h-7 min-w-7 place-items-center rounded bg-[#1e293b] px-1 text-[11px] font-bold text-[#bfdbfe]">
                {config.icon}
              </span>
              <span className="min-w-0 truncate font-semibold text-[#f8fafc]">
                {config.label}
              </span>
              {running && (
                <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[#38bdf8]" />
              )}
            </div>
            <p className="mt-2 text-sm leading-5 text-[#cbd5e1]">
              {summarizeToolOutput(toolName, part.output, part.errorText)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function AssistantMessage({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const plan = parsePlan(text);

  return (
    <div className="w-full space-y-4">
      <ToolTimeline message={message} />
      {text ? (
        <div className="rounded-lg border border-[#263244] bg-[#0b0f16] p-4">
          <h2 className="mb-4 text-2xl font-semibold text-white">{plan.title}</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {plan.sections.map((section, index) => (
              <PlanCard key={`${section.title}-${index}`} section={section} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TravelPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/travel",
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const toolParts = getToolParts(lastAssistant);
  const usedTools = toolParts.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!requestStartedAt) {
      return;
    }

    if (!isLoading) {
      const timeout = window.setTimeout(() => {
        setElapsedMs(window.performance.now() - requestStartedAt);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    const interval = window.setInterval(() => {
      setElapsedMs(window.performance.now() - requestStartedAt);
    }, 100);

    return () => window.clearInterval(interval);
  }, [isLoading, requestStartedAt]);

  const submitPrompt = (prompt: string, startedAt: number) => {
    const text = prompt.trim();

    if (!text || isLoading) {
      return;
    }

    setRequestStartedAt(startedAt);
    setElapsedMs(0);
    sendMessage({ text });
    setInput("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt(input, event.timeStamp);
  };

  return (
    <main className="min-h-screen bg-[#07080b] px-4 py-6 text-[#f8fafc] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1180px] gap-4 lg:grid-cols-[330px_1fr]">
        <aside className="rounded-lg border border-[#263244] bg-[#0d121a] p-4 shadow-xl shadow-black/20 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <header className="border-b border-[#223047] pb-4">
            <p className="text-sm font-medium text-[#93c5fd]">Travel ReAct</p>
            <h1 className="mt-1 text-2xl font-semibold">Asystent podrozy AI</h1>
            <p className="mt-2 text-sm leading-6 text-[#94a3b8]">
              Powiedz dokad jedziesz - agent zaplanuje wszystko.
            </p>
          </header>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">Scenariusze</h2>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  onClick={(event) => submitPrompt(scenario, event.timeStamp)}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-[#253246] bg-[#0b1220] px-3 py-2 text-left text-sm leading-5 text-[#dbeafe] transition hover:border-[#60a5fa] hover:bg-[#111c31] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scenario}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-[#253246] bg-[#111827] p-3">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">Zbierane dane</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#dbeafe]">
              <span className="rounded border border-[#31445e] px-2 py-2">Pogoda</span>
              <span className="rounded border border-[#31445e] px-2 py-2">Waluta</span>
              <span className="rounded border border-[#31445e] px-2 py-2">Swieta</span>
              <span className="rounded border border-[#31445e] px-2 py-2">Atrakcje</span>
            </div>
          </section>
        </aside>

        <section className="flex min-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-lg border border-[#263244] bg-[#0b0f16] shadow-xl shadow-black/20">
          <div className="border-b border-[#223047] bg-[#101722] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#93c5fd]">
                  Plan z prawdziwych danych
                </p>
                <p className="mt-1 text-sm text-[#94a3b8]">
                  Narzedzia: {usedTools} | Model: gemini-3.1-flash-lite | maxSteps: 3
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setRequestStartedAt(null);
                  setElapsedMs(0);
                }}
                className="rounded-lg border border-[#46323a] px-3 py-2 text-sm text-[#fecdd3] transition hover:border-[#fb7185] hover:bg-[#231018]"
              >
                Nowa rozmowa
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
            {messages.length === 0 && (
              <div className="rounded-lg border border-[#253246] bg-[#111827] p-4 text-sm leading-6 text-[#cbd5e1]">
                Wpisz cel podrozy albo wybierz scenariusz. Agent sprawdzi pogode,
                kurs waluty, swieta, Wikipedie i aktualne informacje z wyszukiwarki.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = getMessageText(message);

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {isUser ? (
                    <div className="max-w-[88%] rounded-lg bg-[#1d4ed8] px-4 py-3 text-right text-sm leading-6 text-white sm:max-w-[70%]">
                      {text}
                    </div>
                  ) : (
                    <AssistantMessage message={message} />
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-[#263244] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
                  Agent sprawdza dane podrozy...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <DiagnosticsPanel
            toolParts={toolParts}
            elapsedMs={elapsedMs}
            isLoading={isLoading}
            hasAssistant={!!lastAssistant}
          />

          <form
            onSubmit={onSubmit}
            className="border-t border-[#223047] bg-[#101722] px-4 py-4 sm:px-5"
          >
            <div className="flex gap-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Np. Lece do Barcelony na weekend..."
                className="min-w-0 flex-1 rounded-lg border border-[#31445e] bg-[#0b1220] px-4 py-3 text-[#f8fafc] outline-none transition placeholder:text-[#64748b] focus:border-[#60a5fa]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-lg bg-[#60a5fa] px-5 py-3 font-semibold text-[#06111f] transition hover:bg-[#93c5fd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Wyslij
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
