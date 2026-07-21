import { google } from "@ai-sdk/google";
import { GoogleGenAI, Modality } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, isStepCount, streamText, tool } from "ai";
import { z } from "zod";
import {
  knowledgeBasePrompt,
  knowledgeAnswerPrompt,
  createSearchKnowledge,
  shouldSearchKnowledge,
} from "../../lib/knowledge-tool";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.",
  );
}

const supportedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

const dataUrlPattern = /^data:([^;,]+);base64,([\s\S]+)$/;

const basePersona = `# Clark - Specjalista ds. analizy procesów trade finance i przygotowywania scenariuszy testowych

## KIM JESTEM
Jestem Business Expertem w dziedzinie trade finance z 12-letnim doświadczeniem w bankowości transakcyjnej i jakości systemów finansowych.
Specjalizuję się w analizie procesów akredytyw i gwarancji, projektowaniu scenariuszy testowych dla transakcji międzynarodowych oraz wykrywaniu ryzyk operacyjnych w aplikacjach finansowych.
Pracowałem z bankami, fintechami, zespołami QA, analitykami biznesowymi i product ownerami odpowiedzialnymi za systemy obsługujące handel międzynarodowy.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** - potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** - merytoryczna odpowiedź (max 2 akapity)
3. ✅ **Rekomendacja** - konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** - jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie - pytam o kontekst
- Gdy podaję fakty - oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu
- Używam list numerowanych dla kroków, punktowanych dla opcji
- Maksymalnie 3 akapity + rekomendacja
- Każda odpowiedź ma dokładnie 4 sekcje: 📋 Kontekst, 🔍 Analiza, ✅ Rekomendacja, ❓ Pytanie

### Styl:
- Język: polski
- Ton: profesjonalny, przystępny, analityczny i bezpośredni
- Gdy używam terminu branżowego - wyjaśniam go w nawiasie

## CZEGO NIE ROBIĘ
- Nie odpowiadam na pytania spoza mojej dziedziny - mówię wprost: "To nie moja specjalizacja, ale mogę pomóc z trade finance, analizą procesów i testowaniem aplikacji do transakcji międzynarodowych"
- Nie udaję, że wiem coś, czego nie wiem
- Nie udzielam porad prawnych, medycznych ani inwestycyjnych; przy kwestiach regulacyjnych lub prawnych odsyłam do właściwego specjalisty

## PAMIĘĆ
- Pamiętasz CAŁĄ rozmowę od początku
- Nawiązuj do wcześniejszych wiadomości gdy to istotne
- Jeśli użytkownik zmienia temat - zaakceptuj, ale możesz nawiązać do wcześniejszego kontekstu
- Gdy użytkownik powie "podsumuj" - przygotuj streszczenie CAŁEJ rozmowy w punktach
- Zwracaj się do użytkownika konsekwentnie; jeśli podał imię, używaj go

## KOMENDA "PODSUMUJ"
Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy":
1. Wypisz główne tematy rozmowy
2. Wymień kluczowe ustalenia lub odpowiedzi
3. Zaproponuj, w czym jeszcze możesz pomóc
Format: numerowana lista`;

const systemPrompts = {
  casual: `${basePersona}

Tryb CASUAL:
Clark. Odpowiadaj luźno, jak do kolegi. Skróty myślowe OK. Emoji dozwolone. Krótko - max 2 zdania na punkt. Możesz żartować, ale nadal zachowaj 4 wymagane sekcje odpowiedzi i trzymaj się trade finance oraz testowania aplikacji finansowych.`,
  ekspert: `${basePersona}

Tryb EKSPERT:
Clark. Odpowiadaj formalnie i szczegółowo. Podawaj dane, źródła albo przybliżone punkty odniesienia, gdy to pomaga. Strukturyzuj precyzyjnie i zachowaj 4 wymagane sekcje odpowiedzi. Profesjonalny ton.`,
  kreatywny: `${basePersona}

Tryb KREATYWNY:
Clark. Odpowiadaj w sposób kreatywny i nieszablonowy. Używaj metafor, analogii i krótkiego storytellingu. Podawaj nieoczywiste perspektywy. Zaskakuj i inspiruj, ale nadal zachowaj 4 wymagane sekcje odpowiedzi oraz trzymaj się trade finance i testowania aplikacji finansowych.`,
  search: `Jestes agentem z dostepem do prawdziwego internetu.
Odpowiadasz po polsku, zwiezle i konkretnie.
Masz wlaczone Google Search grounding oraz narzedzie readWebPage do czytania stron WWW.

Zasady:
- Gdy pytanie dotyczy aktualnych informacji, uzywaj wyszukiwania Google.
- Gdy uzytkownik poda URL albo potrzebujesz przeczytac konkretna strone z wynikow, uzyj readWebPage.
- Nie wymyslaj zrodel. Jezeli opierasz sie na internecie, dodaj sekcje "Zrodla" z pelnymi URL.
- Przy datach wzglednych doprecyzuj konkretne daty, jesli to pomaga uniknac niejasnosci.`,
  agent: `Jestes autonomicznym Agentem AI "Pelna moc".
Odpowiadasz po polsku, jasno i konkretnie. Sam decydujesz, ktorych narzedzi uzyc.

Masz narzedzia:
- calculator: dokladne obliczenia
- currentDateTime: aktualna data i czas
- Google Search: aktualne informacje z internetu
- readWebPage: czytanie konkretnych stron WWW
- generateImage: tworzenie logo, grafik i ilustracji
- analiza obrazow: jezeli uzytkownik wklei screenshot, model widzi obraz w wiadomosci

Zasady:
- Dla aktualnych faktow, firm, ofert, wiadomosci i rekomendacji uzywaj Google Search.
- Gdy trzeba zweryfikowac konkretna strone albo wynik wyszukiwania, uzyj readWebPage.
- Gdy uzytkownik prosi o logo, grafike, ilustracje albo post wizualny, uzyj generateImage.
- Dla rachunkow uzywaj calculator i pokaz wynik w czytelny sposob.
- Jezeli korzystasz z internetu, podaj zrodla z URL.
- Przy datach wzglednych podaj konkretna date, gdy pomaga to uniknac niejasnosci.
- Po uzyciu narzedzi podsumuj, co ustaliles, bez udawania pewnosci tam, gdzie jej nie ma.`,
} as const;

const modelIds = {
  flash: "gemini-3.1-flash-lite",
  pro: "gemini-3.1-flash-lite",
} as const;

type ChatMode = keyof typeof systemPrompts;
type ChatModel = keyof typeof modelIds;
type UserPreferences = Record<string, string>;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function getSystemPrompt(mode: unknown) {
  if (typeof mode === "string" && mode in systemPrompts) {
    return systemPrompts[mode as ChatMode];
  }

  return systemPrompts.casual;
}

function normalizePreferences(preferences: unknown): UserPreferences {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(preferences)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value).trim()]),
  );
}

function getPersonalizedSystemPrompt({
  mode,
  displayName,
  userPreferences,
  isNewConversation,
}: {
  mode: unknown;
  displayName: unknown;
  userPreferences: UserPreferences;
  isNewConversation: boolean;
}) {
  const basePrompt = `${getSystemPrompt(mode)}\n\n${knowledgeBasePrompt}`;
  const name = typeof displayName === "string" ? displayName.trim() : "";
  const preferencesText = Object.entries(userPreferences)
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");

  if (name) {
    return `${basePrompt}

Personalizacja:
Rozmawiasz z użytkownikiem: ${name}.
${isNewConversation ? `Na początku tej rozmowy przywitaj go dokładnie: "Cześć, ${name}!"` : "Zwracaj się do użytkownika po imieniu naturalnie, bez powtarzania powitania w każdej odpowiedzi."}${
      preferencesText
        ? `\nZnane preferencje uzytkownika:\n${preferencesText}\nUzywaj tych preferencji naturalnie, gdy pomagaja w odpowiedzi.`
        : ""
    }`;
  }

  return `${basePrompt}

Personalizacja:
Rozmawiasz z użytkownikiem: nieznany.
Jeśli nie znasz imienia użytkownika, zapytaj grzecznie na początku rozmowy.
Gdy użytkownik poda imię, zawsze użyj narzędzia updateUserName. Po udanym zapisie odpowiedz: "Miło Cię poznać, {imię}! Zapamiętam."
Gdy uzytkownik poda trwala preferencje, np. miasto, ulubione jedzenie, styl pracy lub zainteresowania, uzyj narzedzia saveUserPreference.`;
}

function getModelId(model: unknown) {
  if (typeof model === "string" && model in modelIds) {
    return modelIds[model as ChatModel];
  }

  return modelIds.flash;
}

function normalizeImage(image: unknown) {
  if (typeof image !== "string" || !image.trim()) {
    return null;
  }

  const value = image.trim();
  const match = dataUrlPattern.exec(value);
  const mediaType = match?.[1]?.toLowerCase() ?? "image/png";
  const data = match?.[2] ?? value;

  if (!supportedImageTypes.has(mediaType)) {
    throw new Error("Nieobslugiwany format obrazu.");
  }

  return {
    data,
    mediaType,
  };
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractTextFromHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nieznany blad.";
}

function handleStreamError(error: unknown) {
  console.error("Blad streamu czatu:", error);

  return getErrorMessage(error);
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    return {
      response: await fetch(input, {
        ...init,
        signal: controller.signal,
      }),
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        error: "Timeout - serwer nie odpowiedzial w 5 sekund. Sprobuj ponownie.",
      };
    }

    return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

function safeCalculate(expression: string) {
  const normalized = expression.replace(/,/g, ".").trim();

  if (!/^[\d\s+\-*/().%^]+$/.test(normalized)) {
    throw new Error("Dozwolone sa tylko liczby i operatory + - * / % ^ ().");
  }

  const jsExpression = normalized.replace(/\^/g, "**");
  const result = Function(`"use strict"; return (${jsExpression});`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Nie udalo sie policzyc poprawnego wyniku.");
  }

  return result;
}

const calculator = tool({
  description:
    "Wykonuje dokladne obliczenia matematyczne. Uzywaj do VAT, kwot brutto/netto, procentow i rachunkow.",
  inputSchema: z.object({
    expression: z
      .string()
      .describe("Wyrazenie matematyczne, np. 8500 * 1.23 albo 8500 * 0.23"),
  }),
  execute: async ({ expression }) => {
    const forbidden = /\b(import|require|eval|process)\b/i;

    if (forbidden.test(expression)) {
      return {
        expression,
        error: "Wyrazenie zawiera niedozwolone znaki",
      };
    }

    try {
      const result = safeCalculate(expression);

      return {
        expression,
        result,
      };
    } catch {
      return {
        expression,
        error: `Nie moge obliczyc: ${expression}`,
      };
    }
  },
});

const currentDateTime = tool({
  description:
    "Zwraca aktualna date i czas. Uzywaj gdy pytanie dotyczy dzisiaj, teraz, najnowszych informacji albo dat wzglednych.",
  inputSchema: z.object({
    timeZone: z
      .string()
      .optional()
      .describe("Strefa czasowa IANA, domyslnie Europe/Warsaw"),
  }),
  execute: async ({ timeZone = "Europe/Warsaw" }) => {
    const now = new Date();

    return {
      iso: now.toISOString(),
      timeZone,
      local: new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone,
      }).format(now),
    };
  },
});

const readWebPage = tool({
  description:
    "Pobiera i czyta zawartosc strony internetowej. Uzywaj gdy uzytkownik poda URL lub gdy chcesz przeczytac artykul/strone znaleziona w wyszukiwarce.",
  inputSchema: z.object({
    url: z.string().url().describe("Pelny adres URL strony"),
  }),
  execute: async ({ url }) => {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        url,
        error: "Nieprawidlowy adres URL.",
      };
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return {
        url,
        error: "Obslugiwane sa tylko adresy http i https.",
      };
    }

    try {
      const result = await fetchWithTimeout(parsedUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MojAgent/1.0; +https://example.com/agent)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      if ("error" in result) {
        return {
          url,
          error: result.error,
        };
      }

      const { response } = result;

      if (!response.ok) {
        return {
          url,
          error: `API zwrocilo blad ${response.status}. Sprawdz parametry.`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const text = contentType.includes("text/html")
        ? extractTextFromHtml(body)
        : body.replace(/\s+/g, " ").trim();

      return {
        url,
        contentType,
        text: text.slice(0, 3000) || "Strona nie zawiera czytelnego tekstu.",
      };
    } catch (error) {
      return {
        url,
        error: `Blad polaczenia: ${getErrorMessage(error)}`,
      };
    }
  },
});

const generateImage = tool({
  description:
    "Generuje obraz na podstawie opisu. Uzywaj gdy uzytkownik prosi o logo, grafike, ilustracje, post wizualny.",
  inputSchema: z.object({
    prompt: z.string().min(1).describe("Opis obrazu do wygenerowania"),
  }),
  execute: async ({ prompt }) => {
    const apiKey =
      process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return {
        prompt,
        error:
          "Brakuje GOOGLE_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji serwera.",
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          abortSignal: controller.signal,
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => part.inlineData?.data);
      const text = parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join("\n")
        .trim();

      if (!imagePart?.inlineData?.data) {
        return {
          prompt,
          error:
            "Model odpowiedzial, ale nie zwrocil obrazu. Sprobuj zmienic prompt.",
        };
      }

      const mimeType = imagePart.inlineData.mimeType ?? "image/png";

      return {
        prompt,
        image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
        text,
      };
    } catch (error) {
      const isTimeout =
        error instanceof DOMException && error.name === "AbortError";

      return {
        prompt,
        error: isTimeout
          ? "Generowanie przekroczylo limit 30 sekund. Sprobuj ponownie."
          : `Blad API: ${getErrorMessage(error)}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});

function createUserProfileTools(userId: unknown, authenticatedClient?: ReturnType<typeof getSupabaseClient>) {
  const profileId = typeof userId === "string" ? userId.trim() : "";

  const updateUserName = tool({
    description:
      "Zapisuje imie uzytkownika w profilu. Uzywaj, gdy uzytkownik poda swoje imie, np. 'Mam na imie Pawel', 'Jestem Ania'.",
    inputSchema: z.object({
      name: z.string().min(1).max(80).describe("Imie uzytkownika"),
    }),
    execute: async ({ name }) => {
      if (!profileId) {
        return { ok: false, error: "Brak user_id w zadaniu." };
      }

      const supabase = authenticatedClient ?? getSupabaseClient();

      if (!supabase) {
        return { ok: false, error: "Brak konfiguracji Supabase." };
      }

      const normalizedName = name.trim();
      const { error } = await supabase
        .from("user_profiles")
        .update({
          display_name: normalizedName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);

      if (error) {
        console.error("Nie udalo sie zapisac imienia uzytkownika:", error);
        return { ok: false, error: error.message };
      }

      return {
        ok: true,
        name: normalizedName,
        display_name: normalizedName,
        message: `Miło Cię poznać, ${normalizedName}! Zapamiętam.`,
      };
    },
  });

  const saveUserPreference = tool({
    description:
      "Zapisuje trwala preferencje uzytkownika w profilu, np. miasto, ulubione jedzenie, styl odpowiedzi albo zainteresowania.",
    inputSchema: z.object({
      key: z
        .string()
        .min(1)
        .max(60)
        .describe("Klucz preferencji, np. miasto albo ulubione_jedzenie"),
      value: z.string().min(1).max(200).describe("Wartosc preferencji"),
    }),
    execute: async ({ key, value }) => {
      if (!profileId) {
        return { ok: false, error: "Brak user_id w zadaniu." };
      }

      const supabase = authenticatedClient ?? getSupabaseClient();

      if (!supabase) {
        return { ok: false, error: "Brak konfiguracji Supabase." };
      }

      const { data, error: readError } = await supabase
        .from("user_profiles")
        .select("preferences")
        .eq("id", profileId)
        .maybeSingle();

      if (readError) {
        console.error("Nie udalo sie pobrac preferencji uzytkownika:", readError);
        return { ok: false, error: readError.message };
      }

      const currentPreferences = normalizePreferences(data?.preferences);
      const nextPreferences = {
        ...currentPreferences,
        [key.trim()]: value.trim(),
      };

      const { error } = await supabase
        .from("user_profiles")
        .update({
          preferences: nextPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);

      if (error) {
        console.error("Nie udalo sie zapisac preferencji uzytkownika:", error);
        return { ok: false, error: error.message };
      }

      return {
        ok: true,
        key: key.trim(),
        value: value.trim(),
        preferences: nextPreferences,
      };
    },
  });

  return {
    updateUserName,
    saveUserPreference,
  };
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedSupabase(req);
  if (!auth) return new Response("Brak autoryzacji.", { status: 401 });
  const {
    messages,
    mode = "casual",
    model = "flash",
    image,
  } = await req.json();
  const forceKnowledgeSearch = shouldSearchKnowledge(messages);
  const normalizedImage = normalizeImage(image);
  const modelMessages = await convertToModelMessages(messages);
  const authenticatedUserId = auth.user.id;
  const { data: profile, error: profileError } = await auth.client
    .from("user_profiles")
    .select("display_name, preferences")
    .eq("id", authenticatedUserId)
    .maybeSingle();
  if (profileError) return new Response("Nie udało się pobrać profilu.", { status: 500 });
  if (!profile) {
    const { error: createProfileError } = await auth.client
      .from("user_profiles")
      .insert({ id: authenticatedUserId, display_name: null, preferences: {} });
    if (createProfileError) return new Response("Nie udało się utworzyć profilu.", { status: 500 });
  }
  const displayName = profile?.display_name ?? null;
  const normalizedUserPreferences = normalizePreferences(profile?.preferences);
  const userProfileTools = createUserProfileTools(authenticatedUserId, auth.client);
  const searchKnowledge = createSearchKnowledge(auth.client);

  if (normalizedImage) {
    const lastUserMessage = [...modelMessages]
      .reverse()
      .find((message) => message.role === "user");

    if (lastUserMessage && Array.isArray(lastUserMessage.content)) {
      lastUserMessage.content.unshift({
        type: "file",
        mediaType: normalizedImage.mediaType,
        data: { type: "data", data: normalizedImage.data },
      });
    }
  }

  const result = streamText({
    model: google(getModelId(model)),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen below.
    maxSteps: 3,
    system: `${getPersonalizedSystemPrompt({
      mode,
      displayName,
      userPreferences: normalizedUserPreferences,
      isNewConversation: Array.isArray(messages) && messages.filter((message) => message?.role === "user").length <= 1,
    })}${forceKnowledgeSearch ? `\n\n${knowledgeAnswerPrompt}` : ""}`,
    messages: modelMessages,
    tools: {
      ...(process.env.ENABLE_SEARCH_GROUNDING === "true"
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      calculator,
      currentDateTime,
      readWebPage,
      generateImage,
      searchKnowledge,
      ...userProfileTools,
    },
    prepareStep: ({ stepNumber }) =>
      forceKnowledgeSearch && stepNumber === 0
        ? {
            activeTools: ["searchKnowledge"],
            toolChoice: { type: "tool", toolName: "searchKnowledge" },
          }
        : undefined,
    stopWhen: isStepCount(3),
    onError: ({ error }) => {
      console.error("Blad generowania odpowiedzi czatu:", error);
    },
  });

  return result.toUIMessageStreamResponse({
    onError: handleStreamError,
  });
}
