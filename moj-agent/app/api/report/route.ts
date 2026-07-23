import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import {
  calculator,
  readWebPage,
  searchWikipedia,
} from "../../lib/react-tools";

const useSearchGrounding = process.env.ENABLE_SEARCH_GROUNDING === "true";

if (useSearchGrounding) {
  console.warn(
    "UWAGA: Search Grounding jest WLACZONY. Uzywaj go swiadomie i wylacz po testach.",
  );
}

const reportSystemPrompt = `Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat,
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Szukaj danych: Google Search, Wikipedia, strony branżowe
3. Zbierz fakty, liczby, statystyki
4. Napisz raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: [dzisiejsza data]
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić?]

## Źródła
[Lista użytych źródeł z linkami]

ZASADY:
- Używaj PRAWDZIWYCH danych — Google Search, Wikipedia
- Podawaj źródła przy każdym fakcie
- Bądź konkretny — liczby, daty, nazwy
- Raport powinien mieć 500-1000 słów
- Nie wymyślaj statystyk — szukaj!
- Odpowiadaj po polsku.
- Linki zapisuj w formacie Markdown: [nazwa źródła](https://...).
- Jeśli Google Search jest niedostępny, użyj Wikipedii i readWebPage; jasno zaznacz ograniczenia danych.
- Nie opisuj procesu ani wywołań narzędzi w finalnym raporcie — zwróć wyłącznie gotowy raport.

Dzisiejsza data: ${new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
}).format(new Date())}.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen below.
    maxSteps: 8,
    system: reportSystemPrompt,
    messages: modelMessages,
    tools: {
      ...(useSearchGrounding
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      readWebPage,
      searchWikipedia,
      calculator,
    },
    stopWhen: isStepCount(8),
  });

  return result.toUIMessageStreamResponse();
}
