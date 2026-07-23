import { google } from "@ai-sdk/google";
import { streamText } from "ai";

const systemPrompt = `Jesteś profesjonalnym asystentem do zarządzania pocztą.

Dla KAŻDEGO maila wykonaj:
1. KATEGORYZACJA: określ dokładnie jeden typ (zapytanie ofertowe / reklamacja / spam / informacja / prośba o spotkanie).
2. PRIORYTET: Wysoki (wymaga odpowiedzi dziś) / Średni (w ciągu 3 dni) / Niski (może poczekać).
3. DRAFT: napisz krótki, profesjonalny szkic odpowiedzi (3–5 zdań).

Ważne zasady:
- Dla spamu oraz wiadomości czysto informacyjnych, które nie wymagają reakcji, wpisz w drafcie dokładnie: "Brak odpowiedzi — wiadomość nie wymaga reakcji."
- Oceniaj pilność na podstawie terminów, ryzyka utraty klienta i wpływu biznesowego.
- Nie wymyślaj danych, terminów ani wykonanych działań.
- Odpowiadaj wyłącznie po polsku i zachowaj dokładny format poniżej.

FORMAT ODPOWIEDZI:

### Mail [numer]: [krótki temat]
| Kategoria | [typ] |
| Priorytet | [🔴 Wysoki / 🟡 Średni / 🟢 Niski] |
| Uzasadnienie | [jedno krótkie zdanie] |

**Proponowana odpowiedź:**
> [draft odpowiedzi w jednym akapicie]

---

Po wszystkich mailach:

## PODSUMOWANIE
- 🔴 Pilne: [ile]
- 🟡 Średnie: [ile]
- 🟢 Niskie: [ile, bez spamu]
- 🗑️ Spam: [ile]
- ✅ Rekomendacja: [który mail obsłużyć najpierw i dlaczego]`;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Nieprawidłowy format JSON." }, { status: 400 });
  }

  const emails =
    typeof body === "object" &&
    body !== null &&
    "emails" in body &&
    Array.isArray(body.emails)
      ? body.emails.filter(
          (email): email is string =>
            typeof email === "string" && email.trim().length > 0,
        )
      : [];

  if (emails.length === 0) {
    return Response.json(
      { error: "Dodaj co najmniej jeden mail do analizy." },
      { status: 400 },
    );
  }

  if (emails.length > 20) {
    return Response.json(
      { error: "Jednocześnie możesz przeanalizować maksymalnie 20 maili." },
      { status: 400 },
    );
  }

  const numberedEmails = emails
    .map((email, index) => `MAIL ${index + 1}\n${email.trim()}`)
    .join("\n\n==========\n\n");

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    system: systemPrompt,
    prompt: `Przeanalizuj poniższe ${emails.length} wiadomości:\n\n${numberedEmails}`,
  });

  return result.toTextStreamResponse();
}
