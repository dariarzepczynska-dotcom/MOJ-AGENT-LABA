"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConversationRow = {
  id: string;
  title: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MessageRow = {
  id: string;
  role: "user" | "assistant" | string;
  content: string | null;
  created_at?: string | null;
};

function cleanText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function formatFullDate(value: string | null | undefined) {
  if (!value) {
    return "Brak daty";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Brak daty";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ConversationPreviewPage() {
  const params = useParams<{ id: string }>();
  const conversationId = useMemo(() => {
    const rawId = params?.id;

    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);
  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadConversation = async () => {
      if (!conversationId) {
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const { data: conversationData, error: conversationError } =
          await supabase
            .from("conversations")
            .select("id, title, created_at, updated_at")
            .eq("id", conversationId)
            .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (conversationError) {
          throw conversationError;
        }

        if (!conversationData) {
          setError("Nie znaleziono tej rozmowy.");
          setConversation(null);
          setMessages([]);
          return;
        }

        const { data: messageData, error: messagesError } = await supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (!isMounted) {
          return;
        }

        if (messagesError) {
          throw messagesError;
        }

        setConversation(conversationData as ConversationRow);
        setMessages((messageData ?? []) as MessageRow[]);
      } catch (error) {
        console.error("Nie udało się pobrać rozmowy:", error);
        if (isMounted) {
          setError("Nie udało się pobrać rozmowy.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadConversation();

    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  const title = cleanText(conversation?.title) || "Nowa rozmowa";

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden">
        <header className="border-b border-[#2a332f] bg-[#07100e]/80 px-4 py-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#9fe8cf]">
                {formatFullDate(conversation?.updated_at ?? conversation?.created_at)}
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/history"
                className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm font-semibold text-[#dce7e2] transition hover:border-[#3dd6a3]"
              >
                ← Wróć do listy
              </Link>
              {conversationId && (
                <Link
                  href={`/chat?conversationId=${conversationId}`}
                  className="rounded-lg border border-[#3dd6a350] bg-[#0d211b] px-4 py-3 text-sm font-semibold text-[#c7fff0] transition hover:border-[#7af0cb] hover:bg-[#12362b]"
                >
                  🔄 Kontynuuj rozmowę
                </Link>
              )}
            </div>
          </div>
        </header>

        <section className="flex-1 space-y-4 bg-[#050807]/70 px-2 py-6 backdrop-blur-sm sm:px-4">
          {isLoading && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310]/90 px-4 py-6 text-center text-sm text-[#cfe7df]">
              Wczytywanie rozmowy...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm text-[#fecaca]">
              {error}
            </div>
          )}

          {!isLoading && !error && messages.length === 0 && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310]/90 px-4 py-10 text-center text-[#a7b8b0]">
              Ta rozmowa nie ma jeszcze wiadomości.
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <article
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg shadow-black/20 sm:max-w-[75%] sm:text-base ${
                    isUser
                      ? "bg-[#17352d] text-right text-[#edfdf7]"
                      : "border border-[#333] bg-[#1a1a2a] text-left text-[#dce7e2]"
                  }`}
                >
                  <div
                    className={`mb-2 flex flex-wrap gap-2 text-xs font-semibold ${
                      isUser ? "justify-end text-[#baf7df]" : "text-[#9ca3af]"
                    }`}
                  >
                    <span>{isUser ? "user" : "agent"}</span>
                    <span>{formatTime(message.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{cleanText(message.content)}</p>
                </article>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
