"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const exampleTerms = [
  "Sztuczna inteligencja",
  "Agent AI",
  "Prompt",
  "Halucynacja AI",
  "RAG",
  "API",
];

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function FewShotPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/fewshot",
      }),
    [],
  );
  const { messages, sendMessage, status } = useChat({
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();

    if (!text || isLoading) {
      return;
    }

    sendMessage({ text });
    setInput("");
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[800px] flex-col overflow-hidden font-[system-ui]">
        <header className="border-b border-[#242424] pb-5">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            📚 Słownik AI
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af] sm:text-base">
            Wyjaśniam trudne pojęcia prostym językiem.
          </p>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[82%] sm:text-base ${
                    isUser
                      ? "bg-[#2a2a3a] text-right"
                      : "border border-[#333] bg-[#1a1a2a] text-left"
                  }`}
                >
                  {getMessageText(message)}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[#333] bg-[#1a1a2a] px-4 py-3 text-sm text-[#cfcfcf] sm:text-base">
                Szukam prostej analogii...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        <form
          onSubmit={onSubmit}
          className="border-t border-[#242424] pt-4"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {exampleTerms.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setInput(term)}
                className="rounded-full border border-[#333] bg-[#111] px-3 py-2 text-sm text-[#d1d5db] transition hover:border-[#666] hover:text-[#ededed]"
              >
                {term}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Wpisz pojęcie do wyjaśnienia..."
              className="min-w-0 flex-1 rounded-xl border border-[#333] bg-[#111] px-4 py-3 text-[#ededed] outline-none transition focus:border-[#666]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-[#ededed] px-5 py-3 font-medium text-[#0a0a0a] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Wyślij
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
