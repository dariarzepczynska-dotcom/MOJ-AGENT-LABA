"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

const commandExamples = [
  "/tabela języki programowania 2026",
  "/porownanie ChatGPT vs Claude",
  "/lista 5 kroków do pierwszego agenta AI",
  "/faq sztuczna inteligencja dla początkujących",
  "/email podziękowanie za udaną rekrutację",
];

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function isMarkdownTable(lines: string[], index: number) {
  return (
    lines[index]?.includes("|") &&
    lines[index + 1]?.includes("|") &&
    /^(\s*\|?\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])
  );
}

function renderMarkdownTable(lines: string[], startIndex: number) {
  const tableLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].includes("|")) {
    tableLines.push(lines[index]);
    index += 1;
  }

  const rows = tableLines
    .filter((_, rowIndex) => rowIndex !== 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

  return {
    nextIndex: index,
    node: (
      <div className="my-3 overflow-x-auto" key={`table-${startIndex}`}>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr>
              {rows[0]?.map((cell, cellIndex) => (
                <th
                  key={cellIndex}
                  className="border border-[#444] bg-[#111827] px-3 py-2 font-semibold text-[#ededed]"
                >
                  {renderInlineMarkdown(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-[#333] px-3 py-2 text-[#d1d5db]"
                  >
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  };
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      nodes.push(<div key={`space-${index}`} className="h-2" />);
      index += 1;
      continue;
    }

    if (isMarkdownTable(lines, index)) {
      const table = renderMarkdownTable(lines, index);
      nodes.push(table.node);
      index = table.nextIndex;
      continue;
    }

    if (line.startsWith("### ")) {
      nodes.push(
        <h3 key={index} className="mt-3 text-base font-semibold text-[#ededed]">
          {renderInlineMarkdown(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={index} className="mt-3 text-lg font-semibold text-[#ededed]">
          {renderInlineMarkdown(line.slice(3))}
        </h2>,
      );
    } else if (/^\d+\.\s+/.test(line)) {
      nodes.push(
        <p key={index} className="pl-2">
          {renderInlineMarkdown(line)}
        </p>,
      );
    } else if (line.startsWith("- ")) {
      nodes.push(
        <p key={index} className="pl-2">
          • {renderInlineMarkdown(line.slice(2))}
        </p>,
      );
    } else {
      nodes.push(<p key={index}>{renderInlineMarkdown(line)}</p>);
    }

    index += 1;
  }

  return <div className="space-y-1">{nodes}</div>;
}

export default function FormatPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: "/api/format",
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
            📐 Formatowanie
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af] sm:text-base">
            Agent odpowiada w tabeli, liście, porównaniu - na żądanie.
          </p>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const text = getMessageText(message);

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[88%] sm:text-base ${
                    isUser
                      ? "bg-[#2a2a3a] text-right"
                      : "border border-[#333] bg-[#1a1a2a] text-left"
                  }`}
                >
                  {isUser ? (
                    text
                  ) : (
                    <MarkdownPreview text={text} />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[#333] bg-[#1a1a2a] px-4 py-3 text-sm text-[#cfcfcf] sm:text-base">
                Formatowanie odpowiedzi...
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
            {commandExamples.map((command) => (
              <button
                key={command}
                type="button"
                onClick={() => setInput(command)}
                className="rounded-full border border-[#333] bg-[#111] px-3 py-2 text-sm text-[#d1d5db] transition hover:border-[#666] hover:text-[#ededed]"
              >
                {command}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Wpisz komendę, np. /tabela porównanie narzędzi..."
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
