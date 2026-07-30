import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import {
  calculator,
  currentDateTime,
  generateImage,
  getExchangeRate,
  getHolidays,
  getNotes,
  getWeather,
  readWebPage,
  saveNote,
  searchWikipedia,
} from "../../lib/react-tools";
import {
  knowledgeBasePrompt,
  createSearchKnowledge,
  shouldSearchKnowledge,
} from "../../lib/knowledge-tool";
import { createApiUsageOnFinish, enforceDailyTokenLimit } from "@/lib/api-usage";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

const modelId = "gemini-3.1-flash-lite";

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.",
  );
}

const reactSystemPrompt = `Jestes autonomicznym agentem ReAct. Dostajesz cel uzytkownika i realizujesz go krok po kroku po polsku.

Pokazuj uzytkownikowi krotki, uzytkowy proces pracy w formacie:

### Mysle...
Jedno lub dwa zdania: jaki jest najblizszy jawny krok, jakich danych brakuje i ktorego narzedzia uzyjesz. Nie ujawniaj prywatnego lancucha rozumowania.

Nastepnie uzyj narzedzia.

### Obserwuje...
Jedno lub dwa zdania: co zwrocilo narzedzie i czy potrzebny jest kolejny krok.

Powtarzaj az masz wystarczajace dane, maksymalnie 5 glownych krokow.

Na koniec:

### Wynik koncowy
Podaj pelna, konkretna odpowiedz oparta na zebranych danych. Cytuj zrodla: Open-Meteo, NBP, Nager.Date, Wikipedia albo URL z readWebPage.

Zasady:
- Nie zgaduj aktualnych danych: uzyj narzedzi.
- Jezeli zadanie wymaga aktualnego researchu, rozpocznij od Google Search.
- Google Search sluzy do zebrania i porownania wielu aktualnych zrodel.
  readWebPage jest opcjonalne i sluzy tylko do poglebienia wybranego zrodla.
- Nie uzalezniaj wykonania zadania od jednej strony. Gdy readWebPage zwroci
  HTTP 403, pomin te strone i wykorzystaj wyniki Google Search albo inny URL.
- Dla obliczen uzywaj calculator.
- Dla dat wzglednych najpierw uzyj currentDateTime.
- Gdy narzedzie zwroci blad, sprobuj innego sposobu albo jasno poinformuj.
- Blad pojedynczego zrodla (np. HTTP 403) nie konczy zadania. Wybierz inne
  wiarygodne zrodlo i kontynuuj bez ponawiania tego samego adresu.
- Lacz dane z wielu narzedzi w spojna odpowiedz.
- Jesli cel zawiera kilka rezultatow (np. research, podsumowanie, grafike i
  posty), przed zakonczeniem sprawdz liste rezultatow i wykonaj wszystkie.
  Dla zadania research + grafika + tresci wynik ma zawierac co najmniej:
  podsumowanie trendow, post na LinkedIn, post na Facebook, wygenerowana
  grafike oraz sekcje "Zrodla" z adresami URL.
- Po uzyciu narzedzi zawsze zakoncz odpowiedzia zawierajaca sekcje
  "### Wynik koncowy". Nie uzywaj tego naglowka, jezeli nie dostarczasz
  wszystkich wymaganych rezultatow; zamiast tego jasno wskaz brak.
- Nie wywoluj narzedzia tylko po to, aby wypelnic limit krokow. Gdy masz
  wystarczajace dane, przejdz do wyniku koncowego.
- Jezeli zapisujesz dane w notatkach, potwierdz tytul notatki.

${knowledgeBasePrompt}

## OBSLUGA BLEDOW:
- Jesli narzedzie zwroci blad - NIE powtarzaj tego samego wywolania.
- Zamiast tego: poinformuj uzytkownika i zaproponuj alternatywe.
- Przyklad: jesli pogoda nie dziala - "Nie udalo sie sprawdzic pogody w X. Moge poszukac w Google lub sprobowac innego miasta."
- NIGDY nie wywoluj tego samego narzedzia z tymi samymi argumentami dwa razy z rzedu.
- Jesli po 3 nieudanych probach nie masz danych - powiedz wprost czego brakuje.`;

function getLatestUserText(messages: unknown) {
  if (!Array.isArray(messages)) {
    return "";
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user");

  if (!lastUserMessage) {
    return "";
  }

  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content;
  }

  if (!Array.isArray(lastUserMessage.parts)) {
    return "";
  }

  return lastUserMessage.parts
    .filter((part: unknown) => {
      return (
        !!part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text"
      );
    })
    .map((part: unknown) => (part as { text?: unknown }).text)
    .filter((text: unknown): text is string => typeof text === "string")
    .join(" ");
}

function requestsGeneratedImage(text: string) {
  return /\b(wygeneruj|stworz|zrob|przygotuj)\b[\s\S]{0,80}\b(obraz|obrazek|grafik[aeęi]|ilustracj[aeęi]|logo|wizualizacj[aeęi])\b/i.test(
    text,
  );
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedSupabase(req);
  if (!auth) return new Response("Brak autoryzacji.", { status: 401 });
  const limitResponse = await enforceDailyTokenLimit(auth.client);
  if (limitResponse) return limitResponse;

  const { messages } = await req.json();
  const forceKnowledgeSearch = shouldSearchKnowledge(messages);
  const shouldGenerateImage = requestsGeneratedImage(getLatestUserText(messages));
  const modelMessages = await convertToModelMessages(messages);
  const searchKnowledge = createSearchKnowledge(auth.client);

  const result = streamText({
    model: google(modelId),
    system: reactSystemPrompt,
    messages: modelMessages,
    tools: {
      ...(process.env.ENABLE_SEARCH_GROUNDING === "true"
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      readWebPage,
      generateImage,
      calculator,
      currentDateTime,
      getWeather,
      getExchangeRate,
      getHolidays,
      searchWikipedia,
      saveNote,
      getNotes,
      searchKnowledge,
    },
    prepareStep: ({ stepNumber, steps }) => {
      if (forceKnowledgeSearch && stepNumber === 0) {
        return {
          activeTools: ["searchKnowledge"],
          toolChoice: { type: "tool", toolName: "searchKnowledge" },
        };
      }

      const imageWasRequested = shouldGenerateImage;
      const imageWasCalled = steps.some((step) =>
        step.toolCalls.some((call) => call?.toolName === "generateImage"),
      );
      const earliestImageStep = forceKnowledgeSearch ? 1 : 0;

      if (
        imageWasRequested &&
        !imageWasCalled &&
        stepNumber >= earliestImageStep
      ) {
        return {
          activeTools: ["generateImage"],
          toolChoice: { type: "tool", toolName: "generateImage" },
        };
      }

      return undefined;
    },
    stopWhen: isStepCount(8),
    onFinish: createApiUsageOnFinish({
      client: auth.client,
      userId: auth.user.id,
      model: modelId,
      endpoint: "/api/react",
    }),
  });

  return result.toUIMessageStreamResponse();
}
