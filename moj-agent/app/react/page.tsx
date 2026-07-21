"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageWithSources } from "../components/MessageWithSources";

const scenarios = [
  "Planuje weekend w Krakowie. Sprawdz pogode, znajdz ciekawe miejsca w Wikipedii i powiedz czy sa jakies swieta w ten weekend.",
  "Mam 5000 EUR do wydania. Przelicz na PLN, sprawdz ile to w dolarach i zapisz wszystkie kursy w notatkach.",
  "Porownaj pogode w Warszawie, Berlinie i Paryzu. Ktore z tych miast ma dzis najlepsza pogode?",
  "Ile dni do nastepnego swieta w Polsce? Jaka bedzie wtedy pogoda?",
];

const toolLabels: Record<string, { label: string; icon: string }> = {
  searchKnowledge: { label: "Baza wiedzy", icon: "KB" },
  google_search: { label: "Google Search", icon: "G" },
  readWebPage: { label: "readWebPage", icon: "WWW" },
  generateImage: { label: "generateImage", icon: "IMG" },
  calculator: { label: "calculator", icon: "=" },
  currentDateTime: { label: "currentDateTime", icon: "T" },
  getWeather: { label: "getWeather", icon: "WX" },
  getExchangeRate: { label: "getExchangeRate", icon: "FX" },
  getHolidays: { label: "getHolidays", icon: "CAL" },
  searchWikipedia: { label: "searchWikipedia", icon: "W" },
  saveNote: { label: "saveNote", icon: "N+" },
  getNotes: { label: "getNotes", icon: "N" },
};

type AnyPart = UIMessage["parts"][number] & {
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  toolName?: string;
};

type ReactSection = {
  title: string;
  content: string;
  kind: "thought" | "observation" | "result" | "plain";
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

function compact(value: unknown, maxLength = 220) {
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

  if (toolName === "calculator" && "result" in record) {
    return `wynik: ${record.result}`;
  }

  if (toolName === "currentDateTime" && typeof record.dateTime === "string") {
    return record.dateTime;
  }

  if (toolName === "getWeather") {
    return `${record.city}: ${record.temperature} C, wilgotnosc ${record.humidity}%, wiatr ${record.windSpeed} km/h, ${record.description}`;
  }

  if (toolName === "getExchangeRate") {
    return `1 ${record.currency} = ${record.rate} PLN, data ${record.date}`;
  }

  if (toolName === "getHolidays" && Array.isArray(record.holidays)) {
    return `${record.holidays.length} swiat z ${record.source ?? "API"}`;
  }

  if (toolName === "searchWikipedia") {
    return `${record.title}: ${compact(record.summary, 160)}`;
  }

  if (toolName === "saveNote") {
    return `zapisano: ${record.title}`;
  }

  if (toolName === "getNotes" && Array.isArray(output)) {
    return `${output.length} zapisanych notatek`;
  }

  if (toolName === "readWebPage") {
    return `${record.url}: ${compact(record.text, 160)}`;
  }

  if (toolName === "searchKnowledge") {
    const count = typeof record.total_found === "number" ? record.total_found : 0;
    return count > 0
      ? `znaleziono ${count} fragmentów w bazie wiedzy`
      : typeof record.message === "string"
        ? record.message
        : "brak wyników w bazie wiedzy";
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

function parseReactSections(text: string) {
  const sections: ReactSection[] = [];
  const headingRegex = /^###\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRegex)];

  if (matches.length === 0) {
    return text.trim()
      ? [{ title: "Odpowiedz", content: text.trim(), kind: "plain" as const }]
      : [];
  }

  matches.forEach((match, index) => {
    const rawTitle = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length;
    const normalized = rawTitle.toLowerCase();
    const kind = normalized.includes("mysle")
      ? "thought"
      : normalized.includes("obserwuje")
        ? "observation"
        : normalized.includes("wynik")
          ? "result"
          : "plain";

    sections.push({
      title: rawTitle,
      content: text.slice(start, end).trim(),
      kind,
    });
  });

  return sections;
}

function SectionBlock({ section }: { section: ReactSection }) {
  const styles = {
    thought: "border-[#3b82f6] bg-[#1a1a3a] text-[#dbeafe]",
    observation: "border-[#f59e0b] bg-[#2a1a0a] text-[#ffedd5]",
    result: "border-[#22c55e] bg-[#0a2a0a] text-[#dcfce7]",
    plain: "border-[#334155] bg-[#0f172a] text-[#e2e8f0]",
  }[section.kind];

  return (
    <section className={`rounded-lg border p-4 ${styles}`}>
      <h3 className="text-sm font-semibold">{section.title}</h3>
      {section.content && (
        <div className="mt-2 text-sm leading-6">
          <MessageWithSources text={section.content} />
        </div>
      )}
    </section>
  );
}

function ToolTimeline({ message }: { message: UIMessage }) {
  const toolParts = message.parts.filter(isToolPart).map((part) => part as AnyPart);

  if (toolParts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {toolParts.map((part, index) => {
        const toolName = getToolName(part);
        const config = toolLabels[toolName] ?? { label: toolName, icon: "API" };
        const running =
          part.state === "input-streaming" || part.state === "input-available";

        return (
          <div
            key={part.toolCallId ?? `${part.type}-${index}`}
            className="rounded-lg border border-[#36506f] bg-[#0b111a] p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="grid h-7 min-w-7 place-items-center rounded bg-[#1e293b] px-1 text-[11px] font-bold text-[#bfdbfe]">
                {config.icon}
              </span>
              <span className="font-semibold text-[#f8fafc]">{config.label}</span>
              <span className="min-w-0 break-all text-[#94a3b8]">
                {compact(part.input, 120)}
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

function ProgressBar({ usedTools }: { usedTools: number }) {
  const currentStep = Math.min(Math.max(usedTools, 0), 5);
  const progressColor =
    currentStep >= 5 ? "bg-[#ef4444]" : currentStep === 4 ? "bg-[#f59e0b]" : "bg-[#22c55e]";

  return (
    <div className="border-b border-[#223047] bg-[#0b111a] px-4 py-3">
      <div className="flex items-center justify-between text-xs font-medium text-[#cbd5e1]">
        <span>Krok {currentStep} z 5</span>
        <span>{usedTools} wywolan narzedzi</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-[#1e293b]">
        <div
          className={`h-full rounded transition-all ${progressColor}`}
          style={{ width: `${(currentStep / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function ReactAgentPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/react",
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
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1180px] gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-[#263244] bg-[#0d121a] p-4 shadow-xl shadow-black/20 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <header className="border-b border-[#223047] pb-4">
            <h1 className="text-2xl font-semibold">Agent ReAct</h1>
            <p className="mt-2 text-sm leading-6 text-[#94a3b8]">
              Opisz cel, a agent sam planuje, uruchamia narzedzia i sprawdza wyniki.
            </p>
          </header>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">Narzędzia</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.values(toolLabels).map((toolItem) => (
                <div
                  key={toolItem.label}
                  className="rounded-lg border border-[#253246] bg-[#111827] px-3 py-2 text-xs text-[#dbeafe]"
                >
                  <span className="font-semibold text-[#93c5fd]">{toolItem.icon}</span>{" "}
                  {toolItem.label}
                </div>
              ))}
            </div>
          </section>

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
        </aside>

        <section className="flex min-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-lg border border-[#263244] bg-[#0b0f16] shadow-xl shadow-black/20">
          <div className="border-b border-[#223047] bg-[#101722] px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#93c5fd]">
                  Autonomiczne rozumowanie
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Agent ReAct - cel, akcja, obserwacja, wynik
                </h2>
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

          <ProgressBar usedTools={usedTools} />

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
            {messages.length === 0 && (
              <div className="rounded-lg border border-[#253246] bg-[#111827] p-4 text-sm leading-6 text-[#cbd5e1]">
                Wybierz scenariusz albo wpisz cel. Agent moze laczyc pogode,
                waluty, swieta, Wikipedie, kalkulator, notatki, wyszukiwanie i
                czytanie stron WWW i generowanie obrazow.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = getMessageText(message);
              const sections = parseReactSections(text);

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[94%] rounded-lg px-4 py-3 text-sm leading-6 sm:max-w-[86%] ${
                      isUser
                        ? "bg-[#1d4ed8] text-right text-white"
                        : "border border-[#263244] bg-[#111827] text-left text-[#e5edf7]"
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap">{text}</div>
                    ) : (
                      <div className="space-y-3">
                        <ToolTimeline message={message} />
                        {sections.map((section, index) => (
                          <SectionBlock
                            key={`${message.id}-${section.title}-${index}`}
                            section={section}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-[#263244] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
                  Agent planuje kolejny krok...
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
                placeholder="Opisz co chcesz osiagnac..."
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
