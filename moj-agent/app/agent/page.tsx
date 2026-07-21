"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImageAttachmentPreview } from "../components/ImageAttachmentPreview";
import { MessageWithSources } from "../components/MessageWithSources";
import { useImageAttachment } from "../lib/image-attachments";

const tools = [
  { name: "Baza wiedzy", id: "searchKnowledge", icon: "KB" },
  { name: "Kalkulator", id: "calculator", icon: "🧮" },
  { name: "Data i czas", id: "currentDateTime", icon: "🕐" },
  { name: "Google Search", id: "google_search", icon: "🌐" },
  { name: "Czytanie stron", id: "readWebPage", icon: "📄" },
  { name: "Generowanie obrazów", id: "generateImage", icon: "🎨" },
  { name: "Analiza obrazów", id: "vision", icon: "👁️" },
] as const;

const scenarios = [
  "Znajdź w Google co robi firma Syntelligence i wygeneruj dla nich logo",
  "Przeczytaj stronę apple.com i opisz ich aktualną ofertę iPhone",
  "Ile to 23% VAT z 8500 PLN? Podaj kwotę brutto i netto",
  "Jakie są najnowsze wiadomości o AI? Wygeneruj grafikę do posta o tym",
  "Wyszukaj w Google 'best coffee shops Kraków' i streść wyniki",
];

const toolLabels: Record<string, { label: string; icon: string }> = {
  searchKnowledge: { label: "Baza wiedzy", icon: "KB" },
  calculator: { label: "calculator", icon: "🧮" },
  currentDateTime: { label: "currentDateTime", icon: "🕐" },
  google_search: { label: "Google Search", icon: "🌐" },
  readWebPage: { label: "readWebPage", icon: "📄" },
  generateImage: { label: "generateImage", icon: "🎨" },
};

type AnyPart = UIMessage["parts"][number] & {
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  toolName?: string;
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

function summarizeOutput(toolName: string, output: unknown, errorText?: string) {
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

  if (toolName === "currentDateTime" && typeof record.local === "string") {
    return record.local;
  }

  if (toolName === "readWebPage") {
    const url = typeof record.url === "string" ? record.url : "strona";
    const text = typeof record.text === "string" ? record.text : "";
    return `${url}: ${text.slice(0, 140)}${text.length > 140 ? "..." : ""}`;
  }

  if (toolName === "generateImage" && typeof record.image === "string") {
    return "wygenerowany obraz";
  }

  if (toolName === "google_search") {
    return "wyniki wyszukiwania gotowe";
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

function getGeneratedImages(message: UIMessage) {
  return message.parts
    .filter(isToolPart)
    .map((part) => part as AnyPart)
    .filter((part) => getToolName(part) === "generateImage")
    .map((part) => part.output)
    .filter(
      (output): output is { image: string; prompt?: string } =>
        !!output &&
        typeof output === "object" &&
        typeof (output as { image?: unknown }).image === "string",
    );
}

function downloadImage(src: string, index: number) {
  const link = document.createElement("a");
  link.href = src;
  link.download = `agent-image-${index + 1}.png`;
  link.click();
}

function getNowMs() {
  return globalThis.performance?.now() ?? Date.now();
}

function ToolTimeline({
  message,
  isLoading,
}: {
  message: UIMessage;
  isLoading: boolean;
}) {
  const toolParts = message.parts.filter(isToolPart).map((part) => part as AnyPart);

  if (toolParts.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="mb-3 rounded-lg border border-[#2f3b52] bg-[#101722] p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#e5edf7]">
        <span>🤖</span>
        <span>{isLoading ? "Agent wykonuje zadanie..." : "Timeline narzędzi"}</span>
      </div>
      <div className="space-y-3">
        {toolParts.map((part, index) => {
          const toolName = getToolName(part);
          const config = toolLabels[toolName] ?? { label: toolName, icon: "⚙️" };
          const isRunning =
            part.state === "input-streaming" || part.state === "input-available";
          const generatedImageSrc =
            toolName === "generateImage" &&
            part.output &&
            typeof part.output === "object" &&
            typeof (part.output as { image?: unknown }).image === "string"
              ? (part.output as { image: string }).image
              : null;

          return (
            <div
              key={part.toolCallId ?? `${part.type}-${index}`}
              className="rounded-lg border border-[#31445e] bg-[#0b111a] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1e293b] text-xs font-bold text-[#bfdbfe]">
                  {index + 1}
                </span>
                <span className="text-lg">{config.icon}</span>
                <span className="font-semibold text-[#f8fafc]">
                  {config.label}
                </span>
                <span className="min-w-0 break-all text-[#94a3b8]">
                  ({compact(part.input, 90)})
                </span>
                {isRunning && (
                  <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[#38bdf8]" />
                )}
              </div>
              <p className="mt-2 text-sm leading-5 text-[#cbd5e1]">
                → {summarizeOutput(toolName, part.output, part.errorText)}
              </p>
              {generatedImageSrc ? (
                <div className="mt-3">
                  <img
                    src={generatedImageSrc}
                    alt="Wygenerowany obraz"
                    className="max-h-[280px] w-full max-w-[420px] rounded-lg border border-[#31445e] object-contain"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AgentPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const requestStartRef = useRef<number | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const {
    attachedImage,
    imageError,
    isDraggingImage,
    fileInputRef,
    clearImage,
    openFilePicker,
    handlePaste,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageAttachment();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          mode: "agent",
          model: "flash",
        },
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const currentStreamingAssistantId = isLoading
    ? [...messages].reverse().find((message) => message.role === "assistant")?.id
    : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");

    if (lastAssistant && isLoading) {
      activeAssistantIdRef.current = lastAssistant.id;
    }

    if (!isLoading && activeAssistantIdRef.current && requestStartRef.current) {
      const messageId = activeAssistantIdRef.current;
      const elapsed = (getNowMs() - requestStartRef.current) / 1000;
      setDurations((current) => ({
        ...current,
        [messageId]: elapsed,
      }));
      requestStartRef.current = null;
      activeAssistantIdRef.current = null;
    }
  }, [isLoading, messages]);

  const submitPrompt = (prompt: string) => {
    const text = prompt.trim();

    if ((!text && !attachedImage) || isLoading) {
      return;
    }

    requestStartRef.current = getNowMs();
    sendMessage(
      { text: text || "Przeanalizuj ten screenshot i powiedz, co widzisz." },
      attachedImage ? { body: { image: attachedImage.dataUrl } } : undefined,
    );
    setInput("");
    clearImage();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitPrompt(input);
  };

  const clearConversation = () => {
    setMessages([]);
    setDurations({});
    activeAssistantIdRef.current = null;
    requestStartRef.current = null;
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-[#07080b] px-4 py-6 text-[#f8fafc] sm:px-6"
    >
      {isDraggingImage && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/75 text-2xl font-semibold text-[#93c5fd] backdrop-blur-sm">
          Upuść screenshot
        </div>
      )}

      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1180px] gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-lg border border-[#263244] bg-[#0d121a] p-4 shadow-xl shadow-black/20 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <header className="border-b border-[#223047] pb-4">
            <h1 className="text-2xl font-semibold">🤖 Agent AI - Pełna moc</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">
              {tools.length} narzędzi • autonomiczne decyzje
            </p>
          </header>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">
              Moje narzędzia
            </h2>
            <div className="mt-3 space-y-2">
              {tools.map((toolItem) => (
                <div
                  key={toolItem.id}
                  className="flex items-center justify-between rounded-lg border border-[#253246] bg-[#111827] px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{toolItem.icon}</span>
                    <span className="truncate">{toolItem.name}</span>
                  </span>
                  <span className="text-[#86efac]">✅ aktywny</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h2 className="text-sm font-semibold text-[#cbd5e1]">
              Scenariusze
            </h2>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  onClick={() => submitPrompt(scenario)}
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
                  Centrum dowodzenia
                </p>
                <p className="mt-1 text-sm text-[#94a3b8]">
                  Wklej screenshot przez Ctrl+V, wpisz zadanie albo wybierz
                  scenariusz.
                </p>
              </div>
              <button
                type="button"
                onClick={clearConversation}
                className="rounded-lg border border-[#46323a] px-3 py-2 text-sm text-[#fecdd3] transition hover:border-[#fb7185] hover:bg-[#231018]"
              >
                Nowa rozmowa
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
            {messages.length === 0 && (
              <div className="rounded-lg border border-[#253246] bg-[#111827] p-4 text-sm leading-6 text-[#cbd5e1]">
                Agent sam wybiera narzędzia: wyszuka informacje, przeczyta
                stronę, policzy, sprawdzi czas, przeanalizuje obraz i wygeneruje
                grafikę w jednej rozmowie.
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === "user";
              const text = getMessageText(message);
              const toolCount = message.parts.filter(isToolPart).length;
              const generatedImages = getGeneratedImages(message);
              const duration = durations[message.id];

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-lg px-4 py-3 text-sm leading-6 sm:max-w-[84%] ${
                      isUser
                        ? "bg-[#1d4ed8] text-right text-white"
                        : "border border-[#263244] bg-[#111827] text-left text-[#e5edf7]"
                    }`}
                  >
                    {!isUser && (
                      <ToolTimeline
                        message={message}
                        isLoading={currentStreamingAssistantId === message.id}
                      />
                    )}

                    {text &&
                      (isUser ? (
                        <div className="whitespace-pre-wrap">{text}</div>
                      ) : (
                        <MessageWithSources text={text} />
                      ))}

                    {!isUser &&
                      generatedImages.map((image, index) => (
                        <div
                          key={`${image.image}-${index}`}
                          className="mt-3 rounded-lg border border-[#31445e] bg-[#0b111a] p-3"
                        >
                          <img
                            src={image.image}
                            alt={image.prompt ?? "Wygenerowany obraz"}
                            className="max-h-[420px] w-full rounded-lg object-contain"
                          />
                          <button
                            type="button"
                            onClick={() => downloadImage(image.image, index)}
                            className="mt-3 rounded-lg bg-[#38bdf8] px-3 py-2 text-sm font-semibold text-[#031018] transition hover:bg-[#7dd3fc]"
                          >
                            💾 Pobierz
                          </button>
                        </div>
                      ))}

                    {!isUser && (
                      <p className="mt-3 border-t border-[#263244] pt-2 text-xs text-[#94a3b8]">
                        Użyto {toolCount} narzędzi |{" "}
                        {duration ? `${duration.toFixed(1)}s` : isLoading ? "..." : "0.0s"}{" "}
                        | Model: gemini-3.1-flash-lite
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && !currentStreamingAssistantId && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-[#263244] bg-[#111827] px-4 py-3 text-sm text-[#cbd5e1]">
                  Agent startuje...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-[#223047] bg-[#101722] px-4 py-4 sm:px-5"
          >
            {attachedImage && (
              <ImageAttachmentPreview
                image={attachedImage}
                onRemove={clearImage}
                className="mb-3"
              />
            )}
            {imageError && (
              <p className="mb-3 rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-3 py-2 text-sm text-[#fecaca]">
                {imageError}
              </p>
            )}
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={openFilePicker}
                disabled={isLoading}
                aria-label="Dodaj screenshot"
                className="rounded-lg border border-[#31445e] bg-[#0b1220] px-4 py-3 text-lg text-[#dbeafe] transition hover:border-[#60a5fa] disabled:cursor-not-allowed disabled:opacity-50"
              >
                📎
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={handlePaste}
                placeholder="Zleć agentowi zadanie..."
                className="min-w-0 flex-1 rounded-lg border border-[#31445e] bg-[#0b1220] px-4 py-3 text-[#f8fafc] outline-none transition placeholder:text-[#64748b] focus:border-[#60a5fa]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !attachedImage)}
                className="rounded-lg bg-[#60a5fa] px-5 py-3 font-semibold text-[#06111f] transition hover:bg-[#93c5fd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Wyślij
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
