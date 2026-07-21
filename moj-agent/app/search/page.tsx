"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ImageAttachmentPreview } from "../components/ImageAttachmentPreview";
import { useImageAttachment } from "../lib/image-attachments";

const starterQuestions = [
  "Jakie są najnowsze wiadomości o sztucznej inteligencji?",
  "Ile kosztuje iPhone 16 Pro w Polsce?",
  "Kto wygrał ostatni mecz reprezentacji Polski?",
  "Jakie filmy są teraz w kinach?",
];

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function renderLinkedText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>)"]+)/g);

  return parts.map((part, index) => {
    if (!part.match(/^https?:\/\//)) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    const cleanUrl = part.replace(/[.,;:!?]+$/, "");
    const suffix = part.slice(cleanUrl.length);

    return (
      <span key={`${part}-${index}`}>
        <a
          href={cleanUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all text-[#7dd3fc] underline decoration-[#7dd3fc]/40 underline-offset-4 transition hover:text-[#bae6fd]"
        >
          {cleanUrl}
        </a>
        {suffix}
      </span>
    );
  });
}

export default function SearchPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
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
      new TextStreamChatTransport({
        api: "/api/chat",
        body: {
          mode: "search",
          model: "flash",
        },
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

  const submitQuestion = (question: string) => {
    const text = question.trim();

    if ((!text && !attachedImage) || isLoading) {
      return;
    }

    sendMessage(
      { text: text || "Co widzisz na tym obrazie?" },
      attachedImage
        ? { body: { image: attachedImage.dataUrl } }
        : undefined,
    );
    setInput("");
    clearImage();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion(input);
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-screen bg-[#06070a] px-4 py-6 text-[#ededed] sm:px-6"
    >
      {isDraggingImage && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-2xl font-semibold text-[#a5f3fc] backdrop-blur-sm">
          Upusc obraz
        </div>
      )}
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[900px] flex-col overflow-hidden font-[system-ui]">
        <header className="border-b border-[#1f3340] pb-5">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[#256f8a] bg-[#09202a] px-3 py-1 text-xs font-medium text-[#a5f3fc]">
            Google Search grounding
          </div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            🌐 Agent z wyszukiwarką
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#a7b8c2] sm:text-base">
            Przeszukuję prawdziwy internet i czytam strony
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {starterQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => submitQuestion(question)}
                disabled={isLoading}
                className="rounded-lg border border-[#243f4b] bg-[#0a141a] px-3 py-2 text-left text-sm leading-5 text-[#d1d5db] transition hover:border-[#38bdf8] hover:bg-[#0d1d26] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {question}
              </button>
            ))}
          </div>
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
                  className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 shadow-lg shadow-black/20 sm:max-w-[82%] sm:text-base ${
                    isUser
                      ? "bg-[#123240] text-right text-[#ecfeff]"
                      : "border border-[#263f4a] bg-[#0b1217] text-left text-[#e5edf1]"
                  }`}
                >
                  {isUser ? text : renderLinkedText(text)}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-[#263f4a] bg-[#0b1217] px-4 py-3 text-sm text-[#cbd5e1] sm:text-base">
                Szukam i czytam...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        <form
          onSubmit={onSubmit}
          className="border-t border-[#1f3340] pt-4"
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
              aria-label="Dodaj obraz"
              className="rounded-lg border border-[#263f4a] bg-[#0a141a] px-4 py-3 text-lg text-[#cbd5e1] transition hover:border-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              📎
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder="Zapytaj o cokolwiek aktualnego..."
              className="min-w-0 flex-1 rounded-lg border border-[#263f4a] bg-[#0a141a] px-4 py-3 text-[#ededed] outline-none transition placeholder:text-[#64748b] focus:border-[#38bdf8]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !attachedImage)}
              className="rounded-lg bg-[#38bdf8] px-5 py-3 font-semibold text-[#031018] transition hover:bg-[#7dd3fc] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Wyślij
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
