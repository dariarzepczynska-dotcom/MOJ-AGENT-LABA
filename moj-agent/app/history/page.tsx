"use client";

import Link from "next/link";
import { MouseEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConversationRow = {
  id: string;
  title: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string | null;
  content: string | null;
  created_at?: string | null;
};

type ConversationCard = {
  id: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
  preview: string;
  searchableText: string;
};

const databaseTimeoutMs = 8000;

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = databaseTimeoutMs) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Supabase request timed out")),
        timeoutMs,
      );
    }),
  ]);
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, length: number) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 3).trim()}...`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Brak daty";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Brak daty";
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return "przed chwilą";
  }

  const relative = new Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" });

  if (absMs < hour) {
    return relative.format(Math.round(diffMs / minute), "minute");
  }

  if (absMs < day) {
    return relative.format(Math.round(diffMs / hour), "hour");
  }

  if (absMs < 7 * day) {
    return relative.format(Math.round(diffMs / day), "day");
  }

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function highlight(text: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return text;
  }

  const index = text.toLocaleLowerCase("pl-PL").indexOf(
    trimmedQuery.toLocaleLowerCase("pl-PL"),
  );

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + trimmedQuery.length);
  const after = text.slice(index + trimmedQuery.length);

  return (
    <>
      {before}
      <mark className="rounded bg-[#f2d58b]/25 px-0.5 text-[#fff4c7]">
        {match}
      </mark>
      {after}
    </>
  );
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = async () => {
    setIsLoading(true);
    setError("");

    try {
      const { data: conversationRows, error: conversationsError } =
        await withTimeout(
          supabase
            .from("conversations")
            .select("id, title, created_at, updated_at")
            .order("updated_at", { ascending: false }),
        );

      if (conversationsError) {
        throw conversationsError;
      }

      const rows = (conversationRows ?? []) as ConversationRow[];
      const ids = rows.map((conversation) => conversation.id);

      const { data: messageRows, error: messagesError } = ids.length
        ? await withTimeout(
            supabase
              .from("messages")
              .select("id, conversation_id, role, content, created_at")
              .in("conversation_id", ids)
              .order("created_at", { ascending: true }),
          )
        : { data: [], error: null };

      if (messagesError) {
        throw messagesError;
      }

      const messagesByConversation = new Map<string, MessageRow[]>();

      for (const message of (messageRows ?? []) as MessageRow[]) {
        const bucket = messagesByConversation.get(message.conversation_id) ?? [];
        bucket.push(message);
        messagesByConversation.set(message.conversation_id, bucket);
      }

      setConversations(
        rows.map((conversation) => {
          const messages = messagesByConversation.get(conversation.id) ?? [];
          const lastMessage = [...messages]
            .reverse()
            .find((message) => cleanText(message.content));
          const preview = cleanText(lastMessage?.content) || "Brak wiadomości";
          const title = cleanText(conversation.title) || "Nowa rozmowa";

          return {
            id: conversation.id,
            title,
            createdAt: conversation.created_at ?? null,
            updatedAt:
              conversation.updated_at ?? conversation.created_at ?? null,
            messageCount: messages.length,
            preview: truncate(preview, 100),
            searchableText: `${title} ${messages
              .map((message) => cleanText(message.content))
              .join(" ")}`,
          };
        }),
      );
    } catch (error) {
      console.error("Nie udało się pobrać historii rozmów:", error);
      setError("Nie udało się pobrać historii rozmów.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConversations();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");

    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      conversation.searchableText
        .toLocaleLowerCase("pl-PL")
        .includes(normalizedQuery),
    );
  }, [conversations, query]);

  const deleteConversation = async (
    event: MouseEvent<HTMLButtonElement>,
    conversationId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(
      "Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(conversationId);
    setError("");

    try {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (messagesError) {
        throw messagesError;
      }

      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (conversationError) {
        throw conversationError;
      }

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      setToast("Rozmowa usunięta");
      window.setTimeout(() => setToast(""), 2400);
    } catch (error) {
      console.error("Nie udało się usunąć rozmowy:", error);
      setError("Nie udało się usunąć rozmowy.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col gap-5">
        <header className="border-b border-[#2a332f] bg-[#07100e]/80 px-4 py-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
                📜 Historia rozmów
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#a7b8b0] sm:text-base">
                Wszystkie Twoje rozmowy z agentem
              </p>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-lg border border-[#3dd6a350] bg-[#0d211b] px-4 py-3 text-sm font-semibold text-[#c7fff0] transition hover:border-[#7af0cb] hover:bg-[#12362b]"
            >
              Rozpocznij rozmowę
            </Link>
          </div>
          <div className="mt-5">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj w rozmowach..."
              className="w-full rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-[#ededed] outline-none transition placeholder:text-[#6b7d76] focus:border-[#3dd6a3]"
            />
          </div>
        </header>

        {toast && (
          <div className="rounded-lg border border-[#3dd6a350] bg-[#0d211b] px-4 py-3 text-sm font-semibold text-[#c7fff0]">
            {toast}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm text-[#fecaca]">
            {error}
          </div>
        )}

        <section className="flex-1 space-y-3">
          {isLoading && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310]/90 px-4 py-6 text-center text-sm text-[#cfe7df]">
              Wczytywanie historii...
            </div>
          )}

          {!isLoading && filteredConversations.length === 0 && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310]/90 px-4 py-10 text-center shadow-lg shadow-black/20">
              <p className="text-lg font-semibold text-[#f4f7f5]">
                Nie masz jeszcze żadnych rozmów. Zacznij nową!
              </p>
              <Link
                href="/chat"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#3dd6a3] px-5 py-3 font-semibold text-[#04110d] transition hover:bg-[#75e5bd]"
              >
                Rozpocznij rozmowę
              </Link>
            </div>
          )}

          {filteredConversations.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/history/${conversation.id}`}
              className="group block rounded-lg border border-[#333] bg-[#1a1a2a] p-4 text-[#dce7e2] shadow-lg shadow-black/20 transition hover:border-[#61F8F8] hover:bg-[#202033]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-white">
                    {highlight(conversation.title, query)}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#9ca3af]">
                    <span>{formatDate(conversation.updatedAt)}</span>
                    <span aria-hidden>•</span>
                    <span>
                      {conversation.messageCount}{" "}
                      {conversation.messageCount === 1
                        ? "wiadomość"
                        : "wiadomości"}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm italic leading-6 text-[#b5b8c5]">
                    {highlight(conversation.preview, query)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(event) => deleteConversation(event, conversation.id)}
                  disabled={deletingId === conversation.id}
                  className="shrink-0 rounded-lg border border-[#ef4444] bg-[#2a0d0d] px-3 py-2 text-sm font-semibold text-[#fecaca] opacity-100 transition hover:bg-[#3a1212] focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  🗑️ Usuń
                </button>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
