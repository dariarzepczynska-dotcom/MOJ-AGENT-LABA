"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "../components/AuthProvider";
import { ImageAttachmentPreview } from "../components/ImageAttachmentPreview";
import { MessageWithSources } from "../components/MessageWithSources";
import { useImageAttachment } from "../lib/image-attachments";

const chatModes = {
  casual: {
    label: "Casual",
    icon: "💬",
    badgeClass: "bg-[#2f3340] text-[#d1d5db]",
    buttonClass: "border-[#6b7280] bg-[#2f3340] text-[#f3f4f6]",
  },
  ekspert: {
    label: "Ekspert",
    icon: "🎓",
    badgeClass: "bg-[#3a1f27] text-[#fecdd3]",
    buttonClass: "border-[#f43f5e] bg-[#3a1f27] text-[#fecdd3]",
  },
  kreatywny: {
    label: "Kreatywny",
    icon: "🎨",
    badgeClass: "bg-[#173528] text-[#bbf7d0]",
    buttonClass: "border-[#22c55e] bg-[#173528] text-[#bbf7d0]",
  },
} as const;

const chatModels = {
  flash: {
    label: "Flash",
    description: "szybki",
    icon: "⚡",
    badgeClass: "bg-[#2f3340] text-[#d1d5db]",
    buttonClass: "border-[#60a5fa] bg-[#172235] text-[#bfdbfe]",
  },
  pro: {
    label: "Pro",
    description: "zaawansowany",
    icon: "🧠",
    badgeClass: "bg-[#2d2238] text-[#e9d5ff]",
    buttonClass: "border-[#a855f7] bg-[#2d2238] text-[#e9d5ff]",
  },
} as const;

const exampleQuestions = [
  "Jak przygotować scenariusze testowe dla akredytywy dokumentowej?",
  "Jakie ryzyka operacyjne sprawdzić w procesie gwarancji bankowej?",
  "Jak przetestować walidację dokumentów w transakcji międzynarodowej?",
  "Podsumuj różnice między akredytywą a gwarancją w testach systemu",
];

type ChatMode = keyof typeof chatModes;
type ChatModel = keyof typeof chatModels;
type SavedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type DatabaseMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type UserPreferences = Record<string, string>;
type UserProfile = {
  id: string;
  display_name: string | null;
  preferences: UserPreferences | null;
};

const databaseTimeoutMs = 6000;

function getMessageText(message: { parts: Array<{ type: string; text?: string }> }) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

function createConversationTitle(message: string) {
  const title = message.replace(/\s+/g, " ").trim();

  if (!title) {
    return "Nowa rozmowa";
  }

  return title.length > 50 ? `${title.slice(0, 47)}...` : title;
}

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

export default function Home() {
  const { user, accessToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const submittedModeRef = useRef<ChatMode>("casual");
  const submittedModelRef = useRef<ChatModel>("flash");
  const conversationIdRef = useRef<string | null>(null);
  const conversationPromiseRef = useRef<Promise<string | null> | null>(null);
  const conversationHasUserMessageRef = useRef(false);
  const askedForNameRef = useRef(false);
  const savedMessageIdsRef = useRef<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("casual");
  const [model, setModel] = useState<ChatModel>("flash");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [exportStatus, setExportStatus] = useState("");
  const [assistantMessageModes, setAssistantMessageModes] = useState<
    Record<string, ChatMode>
  >({});
  const [assistantMessageModels, setAssistantMessageModels] = useState<
    Record<string, ChatModel>
  >({});
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
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          mode,
          model,
        },
      }),
    [mode, model, accessToken],
  );
  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
  });
  const isLoading = status === "submitted" || status === "streaming";
  const isChatDisabled = isLoading;
  const conversationText = useMemo(
    () =>
      messages
        .map((message) => {
          const author = message.role === "user" ? "User" : "Agent";

          return `${author}: ${getMessageText(message)}`;
        })
        .join("\n"),
    [messages],
  );
  const approximateTokens = Math.ceil(conversationText.length / 4);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isLoadingConversation]);

  useEffect(() => {
    let isMounted = true;

    const loadUserProfile = async () => {
      setIsLoadingProfile(true);
      const userId = user?.id ?? "";

      try {
        if (!userId) return;

        const now = new Date().toISOString();
        await withTimeout(
          supabase
            .from("user_profiles")
            .upsert(
              {
                id: userId,
                preferences: {},
                updated_at: now,
              },
              { onConflict: "id", ignoreDuplicates: true },
            ),
        );

        const { data, error } = await withTimeout(
          supabase
            .from("user_profiles")
            .select("id, display_name, preferences")
            .eq("id", userId)
            .maybeSingle(),
        );

        if (!isMounted) {
          return;
        }

        if (error) {
          console.error("Nie udalo sie pobrac profilu uzytkownika:", error);
          setUserProfile({ id: userId, display_name: null, preferences: {} });
          return;
        }

        setUserProfile({
          id: userId,
          display_name: typeof data?.display_name === "string" ? data.display_name : null,
          preferences:
            data?.preferences && typeof data.preferences === "object"
              ? (data.preferences as UserPreferences)
              : {},
        });
      } catch (error) {
        console.error("Nie udalo sie wczytac profilu uzytkownika:", error);
        if (isMounted && userId) {
          setUserProfile({ id: userId, display_name: null, preferences: {} });
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    void loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    setAssistantMessageModes((currentModes) => {
      const nextModes = { ...currentModes };
      let changed = false;

      for (const message of messages) {
        if (message.role === "assistant" && !nextModes[message.id]) {
          nextModes[message.id] = submittedModeRef.current;
          changed = true;
        }
      }

      return changed ? nextModes : currentModes;
    });

    setAssistantMessageModels((currentModels) => {
      const nextModels = { ...currentModels };
      let changed = false;

      for (const message of messages) {
        if (message.role === "assistant" && !nextModels[message.id]) {
          nextModels[message.id] = submittedModelRef.current;
          changed = true;
        }
      }

      return changed ? nextModels : currentModels;
    });
  }, [messages]);

  const ensureConversation = useCallback((firstMessage: string) => {
    if (conversationIdRef.current) {
      return Promise.resolve(conversationIdRef.current);
    }

    if (conversationPromiseRef.current) {
      return conversationPromiseRef.current;
    }

    conversationPromiseRef.current = Promise.resolve(
      supabase
      .from("conversations")
      .insert({ title: createConversationTitle(firstMessage), user_id: user?.id })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Nie udało się utworzyć rozmowy w Supabase:", error);
          conversationPromiseRef.current = null;
          return null;
        }

        conversationIdRef.current = data.id;
        return data.id as string;
      }),
    );

    return conversationPromiseRef.current;
  }, [user]);

  const saveMessageInBackground = useCallback((message: SavedMessage) => {
    const content = message.content.trim();

    if (!content || savedMessageIdsRef.current.has(message.id)) {
      return;
    }

    savedMessageIdsRef.current.add(message.id);

    void ensureConversation(content).then(async (conversationId) => {
      if (!conversationId) {
        return;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: message.role,
        content,
      });

      if (!error) {
        const conversationUpdates: { title?: string; updated_at: string } = {
          updated_at: new Date().toISOString(),
        };

        if (message.role === "user" && !conversationHasUserMessageRef.current) {
          conversationUpdates.title = createConversationTitle(content);
        }

        const { error: updateError } = await supabase
          .from("conversations")
          .update(conversationUpdates)
          .eq("id", conversationId)
          .eq("user_id", user?.id ?? "");

        if (updateError) {
          console.error(
            "Nie udalo sie zaktualizowac rozmowy w Supabase:",
            updateError,
          );
        } else if (message.role === "user") {
          conversationHasUserMessageRef.current = true;
        }
      }

      if (error) {
        console.error("Nie udało się zapisać wiadomości w Supabase:", error);
      }
    });
  }, [ensureConversation, user]);

  useEffect(() => {
    let isMounted = true;

    const loadLastConversation = async () => {
      setIsLoadingConversation(true);

      try {
        const requestedConversationId = new URLSearchParams(
          window.location.search,
        ).get("conversationId");
        const conversationQuery = requestedConversationId
          ? supabase
              .from("conversations")
              .select("id")
              .eq("id", requestedConversationId)
              .eq("user_id", user?.id ?? "")
              .maybeSingle()
          : supabase
              .from("conversations")
              .select("id")
              .eq("user_id", user?.id ?? "")
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();
        const { data: conversation, error: conversationError } =
          await withTimeout(conversationQuery);

        if (!isMounted) {
          return;
        }

        if (conversationError) {
          console.error(
            "Nie udalo sie pobrac ostatniej rozmowy z Supabase:",
            conversationError,
          );
          return;
        }

        if (!conversation) {
          return;
        }

        const { data: loadedMessages, error: messagesError } =
          await withTimeout(
            supabase
              .from("messages")
              .select("id, role, content")
              .eq("conversation_id", conversation.id)
              .order("created_at", { ascending: true }),
          );

        if (!isMounted) {
          return;
        }

        if (messagesError) {
          console.error(
            "Nie udalo sie pobrac wiadomosci z Supabase:",
            messagesError,
          );
          return;
        }

        const restoredMessages = ((loadedMessages ?? []) as DatabaseMessage[])
          .filter(
            (message) =>
              (message.role === "user" || message.role === "assistant") &&
              message.content,
          )
          .map(
            (message): UIMessage => ({
              id: message.id,
              role: message.role,
              parts: [{ type: "text", text: message.content }],
            }),
          );

        conversationIdRef.current = conversation.id as string;
        conversationPromiseRef.current = Promise.resolve(
          conversation.id as string,
        );
        conversationHasUserMessageRef.current = restoredMessages.some(
          (message) => message.role === "user",
        );
        savedMessageIdsRef.current = new Set(
          restoredMessages.map((message) => message.id),
        );
        setMessages(restoredMessages);
      } catch (error) {
        console.error("Nie udalo sie wczytac rozmowy z Supabase:", error);
      } finally {
        if (isMounted) {
          setIsLoadingConversation(false);
        }
      }
    };

    void loadLastConversation();

    return () => {
      isMounted = false;
    };
  }, [setMessages, user]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    for (const message of messages) {
      if (message.role !== "assistant") {
        continue;
      }

      saveMessageInBackground({
        id: message.id,
        role: "assistant",
        content: getMessageText(message),
      });
    }
  }, [isLoading, messages, saveMessageInBackground]);

  useEffect(() => {
    if (
      isLoadingProfile ||
      isLoadingConversation ||
      userProfile?.display_name ||
      messages.length > 0 ||
      askedForNameRef.current
    ) {
      return;
    }

    const welcomeMessage: UIMessage = {
      id: "welcome-name-request",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Czesc! Jestem Clark, Twoj agent od trade finance i testow systemow finansowych. Jak masz na imie?",
        },
      ],
    };

    askedForNameRef.current = true;
    savedMessageIdsRef.current.add(welcomeMessage.id);
    setMessages([welcomeMessage]);
  }, [
    isLoadingConversation,
    isLoadingProfile,
    messages.length,
    setMessages,
    userProfile?.display_name,
  ]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();

    if ((!text && !attachedImage) || isChatDisabled) {
      return;
    }

    submittedModeRef.current = mode;
    submittedModelRef.current = model;
    const messageText = text || "Co widzisz na tym obrazie?";
    const userMessageId = crypto.randomUUID();

    if (!conversationIdRef.current && !conversationPromiseRef.current) {
      void ensureConversation(messageText);
    }

    saveMessageInBackground({
      id: userMessageId,
      role: "user",
      content: messageText,
    });
    sendMessage(
      { text: messageText },
      attachedImage
        ? { body: { image: attachedImage.dataUrl } }
        : undefined,
    );
    setInput("");
    clearImage();
  };

  const startNewConversation = () => {
    setMessages([]);
    setAssistantMessageModes({});
    setAssistantMessageModels({});
    setExportStatus("");
    setInput("");
    clearImage();
    conversationIdRef.current = null;
    conversationPromiseRef.current = null;
    conversationHasUserMessageRef.current = false;
    askedForNameRef.current = Boolean(userProfile?.display_name);
    savedMessageIdsRef.current.clear();

    const now = new Date().toISOString();
    const conversationPromise = Promise.resolve(
      supabase
      .from("conversations")
      .insert({ title: "Nowa rozmowa", updated_at: now, user_id: user?.id })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error(
            "Nie udalo sie utworzyc nowej rozmowy w Supabase:",
            error,
          );
          conversationPromiseRef.current = null;
          return null;
        }

        conversationIdRef.current = data.id;
        return data.id as string;
      }),
    );

    conversationPromiseRef.current = conversationPromise;
    void conversationPromise;
  };

  const exportConversation = async () => {
    if (!conversationText) {
      setExportStatus("Brak rozmowy");
      window.setTimeout(() => setExportStatus(""), 1800);
      return;
    }

    try {
      await navigator.clipboard.writeText(conversationText);
      setExportStatus("Skopiowano!");
    } catch {
      setExportStatus("Nie udało się skopiować");
    }

    window.setTimeout(() => setExportStatus(""), 1800);
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative isolate min-h-screen overflow-hidden bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6"
    >
      {isDraggingImage && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-2xl font-semibold text-[#9fe8cf] backdrop-blur-sm">
          Upusc obraz
        </div>
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,5,6,0.96),rgba(9,15,19,0.94)_45%,rgba(5,5,6,0.98)),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px]" />
        <div className="absolute left-[-12%] top-24 h-px w-[70%] rotate-[-12deg] bg-[#3dd6a355]" />
        <div className="absolute right-[-10%] top-64 h-px w-[65%] rotate-[10deg] bg-[#b6d8ff40]" />
        <div className="absolute left-[10%] bottom-28 h-px w-[78%] rotate-[-5deg] bg-[#d7b56d35]" />
        <div className="absolute right-[6%] top-28 hidden w-56 rotate-3 border border-[#3dd6a340] bg-[#0d1715]/70 p-4 text-xs text-[#9fe8cf]/70 shadow-2xl shadow-black/30 lg:block">
          <div className="mb-3 flex items-center justify-between border-b border-[#3dd6a330] pb-2">
            <span className="font-semibold">LC-700</span>
            <span>ISSUED</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-4/5 bg-[#3dd6a330]" />
            <div className="h-2 w-2/3 bg-[#3dd6a325]" />
            <div className="h-2 w-5/6 bg-[#3dd6a330]" />
          </div>
        </div>
        <div className="absolute left-[4%] top-72 hidden w-52 rotate-[-5deg] border border-[#d7b56d40] bg-[#17120b]/70 p-4 text-xs text-[#f2d58b]/70 shadow-2xl shadow-black/30 md:block">
          <div className="mb-3 border-b border-[#d7b56d35] pb-2 font-semibold">
            SWIFT MT700
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-2 bg-[#d7b56d30]" />
            <div className="h-2 bg-[#d7b56d20]" />
            <div className="h-2 bg-[#d7b56d25]" />
            <div className="h-2 bg-[#d7b56d30]" />
          </div>
        </div>
        <div className="absolute bottom-24 right-[12%] hidden w-60 rotate-[-2deg] border border-[#8ab4ff35] bg-[#0c111b]/70 p-4 text-xs text-[#bfd6ff]/65 shadow-2xl shadow-black/30 xl:block">
          <div className="mb-3 flex items-center justify-between border-b border-[#8ab4ff30] pb-2">
            <span className="font-semibold">INVOICE</span>
            <span>QA PASS</span>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-full bg-[#8ab4ff24]" />
            <div className="h-2 w-3/4 bg-[#8ab4ff20]" />
            <div className="h-2 w-5/6 bg-[#8ab4ff24]" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[980px] flex-col overflow-hidden font-[system-ui]">
        <header className="border-b border-[#2a332f] bg-[#07100e]/80 px-4 py-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3dd6a340] bg-[#0c1916] px-3 py-1 text-xs font-medium text-[#9fe8cf]">
              <span>Trade finance QA desk</span>
              <span className="h-1 w-1 rounded-full bg-[#3dd6a3]" />
              <span>Live assistant</span>
            </div>
            <button
              type="button"
              onClick={startNewConversation}
              disabled={isLoadingConversation}
              className="rounded-lg border border-[#3dd6a350] bg-[#0d211b] px-3 py-2 text-sm font-semibold text-[#c7fff0] transition hover:border-[#7af0cb] hover:bg-[#12362b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Nowa rozmowa
            </button>
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
            Clark - ekspert trade finance 💼
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a7b8b0] sm:text-base">
            Ekspert od trade finance, analizy procesów i testów systemów
            obsługujących transakcje międzynarodowe. Zapytaj mnie o akredytywy,
            gwarancje, dokumenty handlowe albo scenariusze QA.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {exampleQuestions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setInput(question)}
                className="rounded-lg border border-[#2f403b] bg-[#091310]/85 px-3 py-2 text-left text-sm leading-5 text-[#d1d5db] shadow-sm shadow-black/20 transition hover:border-[#3dd6a3] hover:bg-[#0d1d18] hover:text-[#ededed]"
              >
                {question}
              </button>
            ))}
          </div>
        </header>

        <section className="border-b border-[#24312d] bg-[#070b0a]/75 px-4 py-4 backdrop-blur-md sm:px-6">
          <p className="mb-2 text-sm font-semibold text-[#dce7e2]">
            Model AI
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(chatModels).map(([modelKey, config]) => {
              const typedModel = modelKey as ChatModel;
              const isActive = typedModel === model;

              return (
                <button
                  key={typedModel}
                  type="button"
                  onClick={() => setModel(typedModel)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? config.buttonClass
                      : "border-[#2d3734] bg-[#0a0f0e] text-[#9ca3af] hover:border-[#3f5d54] hover:text-[#ededed]"
                  }`}
                >
                  <span className="mr-1">{config.icon}</span>
                  {config.label}{" "}
                  <span className="font-normal text-current opacity-75">
                    ({config.description})
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="border-b border-[#24312d] bg-[#070b0a]/75 px-4 py-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setIsContextOpen((isOpen) => !isOpen)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-[#ededed]">
              Kontekst rozmowy
            </span>
            <span className="text-xs text-[#9ca3af]">
              {isContextOpen ? "Ukryj" : "Pokaż"}
            </span>
          </button>

          {isContextOpen && (
            <div className="mt-3 rounded-lg border border-[#2f403b] bg-[#091310]/90 p-3 shadow-lg shadow-black/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#9ca3af]">
                  Wiadomości: {messages.length} | ~Tokeny: {approximateTokens}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={exportConversation}
                    className="rounded-lg border border-[#3d514b] bg-[#0d1715] px-3 py-2 text-sm text-[#ededed] transition hover:border-[#3dd6a3]"
                  >
                    📋 Eksportuj rozmowę
                  </button>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="rounded-lg border border-[#4b2a2a] px-3 py-2 text-sm text-[#fecaca] transition hover:border-[#ef4444]"
                  >
                    🗑 Nowa rozmowa
                  </button>
                </div>
              </div>
              {exportStatus && (
                <p className="mt-2 text-sm text-[#bbf7d0]">{exportStatus}</p>
              )}
            </div>
          )}
        </section>

        <section className="flex-1 space-y-4 overflow-y-auto bg-[#050807]/70 px-2 py-6 backdrop-blur-sm sm:px-4">
          {isLoadingConversation && (
            <div className="flex h-full min-h-48 items-center justify-center">
              <div className="flex items-center gap-3 rounded-lg border border-[#2f403b] bg-[#091310]/90 px-4 py-3 text-sm text-[#cfe7df] shadow-lg shadow-black/20">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3dd6a3] border-t-transparent" />
                Wczytywanie rozmowy...
              </div>
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const messageMode =
              message.role === "assistant"
                ? assistantMessageModes[message.id] ?? mode
                : mode;
            const modeConfig = chatModes[messageMode];
            const messageModel =
              message.role === "assistant"
                ? assistantMessageModels[message.id] ?? model
                : model;
            const modelConfig = chatModels[messageModel];

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] sm:text-base ${
                    isUser
                      ? "bg-[#17352d] text-right text-[#edfdf7] shadow-lg shadow-black/20"
                      : "border border-[#2f403b] bg-[#0b1412] text-left shadow-lg shadow-black/20"
                  }`}
                >
                  {!isUser && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${modeConfig.badgeClass}`}
                      >
                        <span>{modeConfig.icon}</span>
                        <span>{messageMode}</span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${modelConfig.badgeClass}`}
                      >
                        <span>{modelConfig.icon}</span>
                        <span>{messageModel}</span>
                      </span>
                    </div>
                  )}
                  {isUser ? (
                    getMessageText(message)
                  ) : (
                    <MessageWithSources text={getMessageText(message)} />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[#333] bg-[#1a1a2a] px-4 py-3 text-sm text-[#cfcfcf] sm:text-base">
                Myślę...
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm leading-6 text-[#fecaca] sm:max-w-[75%] sm:text-base">
                Nie udalo sie pobrac odpowiedzi agenta. Sprawdz konfiguracje API
                i sprobuj ponownie.
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        <form
          onSubmit={onSubmit}
          className="border-t border-[#24312d] bg-[#070b0a]/85 px-4 py-4 backdrop-blur-md sm:px-6"
        >
          <div className="mb-3 grid grid-cols-3 gap-2">
            {Object.entries(chatModes).map(([modeKey, config]) => {
              const typedMode = modeKey as ChatMode;
              const isActive = typedMode === mode;

              return (
                <button
                  key={typedMode}
                  type="button"
                  onClick={() => setMode(typedMode)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? config.buttonClass
                      : "border-[#2d3734] bg-[#0a0f0e] text-[#9ca3af] hover:border-[#3f5d54] hover:text-[#ededed]"
                  }`}
                >
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </button>
              );
            })}
          </div>

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
              disabled={isChatDisabled}
              aria-label="Dodaj obraz"
              className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-lg text-[#dce7e2] transition hover:border-[#3dd6a3] disabled:cursor-not-allowed disabled:opacity-50"
            >
              📎
            </button>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder="Napisz wiadomość..."
              className="min-w-0 flex-1 rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-[#ededed] outline-none transition placeholder:text-[#6b7d76] focus:border-[#3dd6a3]"
              disabled={isChatDisabled}
            />
            <button
              type="submit"
              disabled={isChatDisabled || (!input.trim() && !attachedImage)}
              className="rounded-lg bg-[#3dd6a3] px-5 py-3 font-semibold text-[#04110d] transition hover:bg-[#75e5bd] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Wyślij
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
