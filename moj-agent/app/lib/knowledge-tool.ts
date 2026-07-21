import type { SupabaseClient } from "@supabase/supabase-js";
import { tool } from "ai";
import { z } from "zod";
import { generateEmbedding } from "@/lib/embeddings";

type MatchDocumentRow = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export type KnowledgeSearchResult = {
  title: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  added_at: string | null;
};

const knowledgeQueryPattern =
  /\b(cen(?:a|y|nik|niki|ę|ie)|koszt(?:y|uje|ować|ował)?|pakiet(?:y|u|ach)?|ofert(?:a|y|ę|ach)|regulamin(?:u|ie)?|procedur(?:a|y|ę|ach)|warunk(?:i|ów|ach)|faq|firm(?:a|y|ie|ę)|usług(?:a|i|ę|ach)|rezygnacj(?:a|i|ę)|zwrot(?:y|u|ach)?|reklamacj(?:a|i|ę)|płatnoś(?:ć|ci)|dostaw(?:a|y|ę)|price|pricing|cost|package|offer|terms|company|service)\b/i;

export function shouldSearchKnowledge(messages: unknown) {
  if (!Array.isArray(messages)) {
    return false;
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find(
      (message): message is Record<string, unknown> =>
        !!message &&
        typeof message === "object" &&
        (message as Record<string, unknown>).role === "user",
    );

  if (!lastUserMessage) {
    return false;
  }

  const parts = lastUserMessage.parts;
  const text = Array.isArray(parts)
    ? parts
        .filter(
          (part): part is Record<string, unknown> =>
            !!part && typeof part === "object",
        )
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join(" ")
    : typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : "";

  return knowledgeQueryPattern.test(text);
}

export const knowledgeBasePrompt = `Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.

ZASADY KORZYSTANIA Z BAZY WIEDZY:
1. Gdy użytkownik pyta o ceny, pakiety, oferty, regulamin, procedury, warunki, FAQ, firmę lub jej usługi — ZAWSZE użyj searchKnowledge.
2. Odpowiadaj TYLKO na podstawie fragmentów zwróconych przez searchKnowledge — nie wymyślaj.
3. Jeśli baza wiedzy nie zawiera odpowiedzi, powiedz wprost: "Nie mam tej informacji w bazie wiedzy. Skontaktuj się z firmą."
4. NIE halucynuj — lepiej powiedzieć "nie wiem" niż zmyślić cenę lub warunki.

PRIORYTET NARZĘDZI:
- Pytania o firmę, cennik, ofertę, regulamin lub FAQ → searchKnowledge (NAJPIERW)
- Pytania ogólne → Google Search lub inne narzędzia
- Obliczenia → calculator

CYTOWANIE ŹRÓDEŁ:
- Gdy odpowiadasz na podstawie bazy wiedzy, ZAWSZE na końcu odpowiedzi podaj źródło.
- Dla jednego dokumentu użyj dokładnego formatu, bez nawiasów: "📎 Źródło: Cennik 2026".
- Gdy łączysz informacje z wielu dokumentów, użyj formatu bez nawiasów: "📎 Źródła: Cennik 2026, FAQ".
- Cytuj wyłącznie dokumenty wymienione w polu source_documents wyniku searchKnowledge.
- Nie umieszczaj w cytowaniu dokumentu, którego fragmentów nie użyłeś w odpowiedzi.

ODMOWA ODPOWIEDZI DLA TEMATÓW FIRMOWYCH:
- Gdy searchKnowledge zwróci total_found = 0 lub brak wyniku z similarity >= 0.5, NIE odpowiadaj z wiedzy ogólnej i NIE używaj wyszukiwarki internetowej jako zastępstwa.
- Powiedz dokładnie: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio."
- Możesz następnie zaproponować: "Mogę za to odpowiedzieć na pytania o cennik, pakiety i warunki usługi."
- Ta odmowa dotyczy wyłącznie pytań firmowych. Na pytania ogólne, np. o pogodę, kursy walut lub Wikipedię, odpowiadaj normalnie przy użyciu właściwych narzędzi.`;

export const knowledgeAnswerPrompt = `BIEŻĄCE PYTANIE DOTYCZY BAZY WIEDZY FIRMY.
W tej odpowiedzi reguły poniżej mają pierwszeństwo przed formatem persony:
- Nie używaj sekcji "Kontekst", "Analiza", "Rekomendacja" ani "Pytanie".
- Nie witaj się, nie pytaj o imię i nie dodawaj pytania pogłębiającego.
- Odpowiedz bezpośrednio i zwięźle, najlepiej w 1-3 zdaniach.
- Nie dodawaj rekomendacji, których nie ma w znalezionych fragmentach.
- Nie zakładaj brakujących jednostek, warunków ani sposobu zakupu.
- Na końcu dodaj źródło bez nawiasów kwadratowych, np. "📎 Źródło: Cennik 2026".
- Jeśli nie ma trafnego wyniku, zastosuj dokładnie regułę odmowy z promptu bazy wiedzy.`;

export async function findKnowledge(query: string, authenticatedClient: SupabaseClient) {
  const embedding = await generateEmbedding(query.trim());
  const supabase = authenticatedClient;
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 5,
  });

  if (error) {
    throw error;
  }

  const matches = (data ?? []) as MatchDocumentRow[];
  const ids = matches.map((match) => match.id);
  const addedAtById = new Map<string, string | null>();

  if (ids.length > 0) {
    const { data: dateRows, error: dateError } = await supabase
      .from("documents")
      .select("id, created_at")
      .in("id", ids);

    if (dateError) {
      throw dateError;
    }

    for (const row of dateRows ?? []) {
      addedAtById.set(
        row.id,
        typeof row.created_at === "string" ? row.created_at.slice(0, 10) : null,
      );
    }
  }

  const results: KnowledgeSearchResult[] = matches
    .filter((match) => match.similarity >= 0.5)
    .map(({ id, title, content, metadata, similarity }) => ({
      title,
      content,
      similarity,
      metadata: metadata ?? {},
      added_at: addedAtById.get(id) ?? null,
    }));

  return {
    results,
    total_found: results.length,
    source_documents: [...new Set(results.map((result) => result.title))],
  };
}

export function createSearchKnowledge(authenticatedClient: SupabaseClient) { return tool({
  description: `Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty).
Używaj ZAWSZE, gdy użytkownik pyta o:
- ceny, pakiety, koszty
- procedury, regulaminy, warunki
- FAQ, pytania o firmę lub usługi
- cokolwiek, co może być w dokumentach firmowych`,
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe('Pytanie użytkownika, np. "ile kosztuje pakiet premium".'),
  }),
  execute: async ({ query }) => {
    try {
      const searchResult = await findKnowledge(query, authenticatedClient);

      if (searchResult.total_found === 0) {
        return {
          results: [],
          total_found: 0,
          source_documents: [],
          message: "Nie znaleziono informacji w bazie wiedzy.",
        };
      }

      return searchResult;
    } catch (error) {
      console.error("Nie udało się przeszukać bazy wiedzy:", error);

      return {
        results: [],
        total_found: 0,
        source_documents: [],
        message: "Nie udało się przeszukać bazy wiedzy.",
      };
    }
  },
}); }
