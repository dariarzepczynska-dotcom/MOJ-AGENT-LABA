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
  searchKnowledge,
  shouldSearchKnowledge,
} from "../../lib/knowledge-tool";

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
- Dla obliczen uzywaj calculator.
- Dla dat wzglednych najpierw uzyj currentDateTime.
- Gdy narzedzie zwroci blad, sprobuj innego sposobu albo jasno poinformuj.
- Lacz dane z wielu narzedzi w spojna odpowiedz.
- Jezeli zapisujesz dane w notatkach, potwierdz tytul notatki.

${knowledgeBasePrompt}

## OBSLUGA BLEDOW:
- Jesli narzedzie zwroci blad - NIE powtarzaj tego samego wywolania.
- Zamiast tego: poinformuj uzytkownika i zaproponuj alternatywe.
- Przyklad: jesli pogoda nie dziala - "Nie udalo sie sprawdzic pogody w X. Moge poszukac w Google lub sprobowac innego miasta."
- NIGDY nie wywoluj tego samego narzedzia z tymi samymi argumentami dwa razy z rzedu.
- Jesli po 3 nieudanych probach nie masz danych - powiedz wprost czego brakuje.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const forceKnowledgeSearch = shouldSearchKnowledge(messages);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen below.
    maxSteps: 3,
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
    prepareStep: ({ stepNumber }) =>
      forceKnowledgeSearch && stepNumber === 0
        ? {
            activeTools: ["searchKnowledge"],
            toolChoice: { type: "tool", toolName: "searchKnowledge" },
          }
        : undefined,
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse();
}
