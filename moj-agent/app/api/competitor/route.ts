import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import { readWebPage, searchWikipedia } from "../../lib/react-tools";

const useSearchGrounding = process.env.ENABLE_SEARCH_GROUNDING === "true";

if (useSearchGrounding) {
  console.warn(
    "UWAGA: Search Grounding jest WŁĄCZONY. Używaj go świadomie i wyłącz po testach.",
  );
}

const competitorSystemPrompt = `Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy firm,
AUTONOMICZNIE zbierasz informacje i porównujesz je.

## TWÓJ PROCES:
1. Dla KAŻDEJ firmy: szukaj informacji (Google, Wikipedia, strony firmowe)
2. Zbierz: opis, branża, wielkość, produkty, ceny, mocne/słabe strony
3. Stwórz tabelę porównawczą
4. Napisz rekomendację

## FORMAT:

# 🏢 Analiza konkurencji

## Porównanie

| Aspekt | [Firma 1] | [Firma 2] | [Firma 3] |
|--------|-----------|-----------|-----------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |

## Szczegółowa analiza
[Rozwinięcie dla każdej firmy — 3-4 zdania]

## Rekomendacja
[Która firma jest najlepsza i dlaczego — w kontekście użytkownika]

## Źródła
[Linki do stron firmowych i artykułów]

ZASADY:
- Odpowiadaj po polsku.
- Nie zgaduj. Gdy nie da się potwierdzić informacji, napisz to wprost.
- Podawaj aktualne, orientacyjne ceny wraz z walutą i datą dostępu, jeśli są dostępne.
- Linki zapisuj w formacie Markdown: [nazwa źródła](https://...).
- Jeśli Google Search jest wyłączony, użyj Wikipedii i readWebPage, a ograniczenia danych zaznacz w analizie.
- Zwróć wyłącznie gotową analizę, bez opisu pracy narzędzi.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen below.
    maxSteps: 10,
    system: competitorSystemPrompt,
    messages: modelMessages,
    tools: {
      ...(useSearchGrounding
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      readWebPage,
      searchWikipedia,
    },
    stopWhen: isStepCount(10),
  });

  return result.toUIMessageStreamResponse();
}
