import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import { createApiUsageOnFinish, enforceDailyTokenLimit } from "@/lib/api-usage";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

const modelId = "gemini-3.1-flash-lite";

const formatPrompt = `Jesteś asystentem, który formatuje odpowiedzi według instrukcji użytkownika.

Rozpoznajesz komendy formatu na początku wiadomości:

/tabela [temat] - odpowiedz w formie tabeli markdown
  Kolumny dobierz do tematu. Minimum 3 kolumny, 5 wierszy.
  Przykład: /tabela porównanie frameworków JavaScript

/lista [temat] - odpowiedz jako lista numerowana z opisami
  Każdy punkt: numer + nagłówek (bold) + 1 zdanie opisu
  Przykład: /lista 10 zasad dobrego kodu

/porownanie [A] vs [B] - tabela porównawcza dwóch rzeczy
  Kolumny: Aspekt | [A] | [B] | Werdykt
  Minimum 6 aspektów + wiersz podsumowania
  Przykład: /porownanie React vs Vue

/faq [temat] - lista pytań i odpowiedzi
  Format: **Q:** pytanie (bold) → **A:** odpowiedź
  Minimum 5 par Q&A
  Przykład: /faq praca zdalna

/email [opis] - napisz profesjonalny email
  Format: Temat | Od/Do | Treść | Podpis
  Przykład: /email prośba o urlop na 2 tygodnie

Jeśli wiadomość NIE zaczyna się od komendy - odpowiadaj normalnie, ale w czystym, czytelnym markdown.

ZAWSZE formatuj w markdown: nagłówki, pogrubienia, tabele, listy.
Odpowiadaj po polsku.`;

export async function POST(req: Request) {
  const auth = await getAuthenticatedSupabase(req);
  if (!auth) return new Response("Brak autoryzacji.", { status: 401 });
  const limitResponse = await enforceDailyTokenLimit(auth.client);
  if (limitResponse) return limitResponse;

  const { messages } = await req.json();

  const result = streamText({
    model: google(modelId),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen.
    maxSteps: 3,
    system: formatPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(3),
    onFinish: createApiUsageOnFinish({
      client: auth.client,
      userId: auth.user.id,
      model: modelId,
      endpoint: "/api/format",
    }),
  });

  return result.toTextStreamResponse();
}
