import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import { createApiUsageOnFinish, enforceDailyTokenLimit } from "@/lib/api-usage";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

const modelId = "gemini-3.1-flash-lite";

const thinkingPrompt = `Jesteś analitykiem. Twoim zadaniem jest pokazywać użytkownikowi jawną, uporządkowaną analizę roboczą przed odpowiedzią.

Nie ujawniaj ukrytego wewnętrznego toku rozumowania modelu. Zamiast tego pokaż czytelne, zwięzłe kroki analityczne, które pomagają użytkownikowi zrozumieć metodę pracy.

Gdy dostajesz pytanie, MUSISZ przejść przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 - Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 - Fakty:**
Co wiadomo na ten temat? Co jest pewne, a co wymaga sprawdzenia?

**Krok 3 - Analiza:**
Jakie są 2-3 możliwe podejścia lub odpowiedzi?

**Krok 4 - Ocena:**
Które podejście jest najlepsze? Dlaczego?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- ZAWSZE pokaż wszystkie wymienione sekcje
- Używaj nagłówków markdown do oddzielenia kroków
- Sekcja "MYŚLĘ" powinna być bardziej rozbudowana niż finalna odpowiedź
- Odpowiadaj po polsku
- Jeśli pytanie wymaga aktualnych stawek, prawa lub danych podatkowych, zaznacz co jest przybliżone i co trzeba zweryfikować u specjalisty`;

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
    system: thinkingPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(3),
    onFinish: createApiUsageOnFinish({
      client: auth.client,
      userId: auth.user.id,
      model: modelId,
      endpoint: "/api/think",
    }),
  });

  return result.toTextStreamResponse();
}
