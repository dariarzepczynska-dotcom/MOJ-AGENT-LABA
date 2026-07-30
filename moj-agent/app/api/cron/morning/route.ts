import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  getCurrentDateTimeData,
  getExchangeRateData,
  getWeatherData,
  getWorldNewsData,
} from "@/app/lib/react-tools";
import { enforceDailyTokenLimit, logApiUsage } from "@/lib/api-usage";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const modelId = "gemini-3.1-flash-lite";

const systemPrompt = `Jesteś osobistym asystentem. Napisz poranny briefing w formacie:

# ☀️ Dzień dobry! Twój briefing na [data]

## 🌤️ Pogoda
[temperatura, opis, co ubrać]

## 💶 Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## 📅 Dzisiejszy dzień
- Dzień tygodnia: [...]
- Uwagi: [czy dziś święto? dzień wolny?]

## 🌍 3 najważniejsze wiadomości ze świata
1. **[krótki tytuł]** — [jednozdaniowe podsumowanie] ([źródło](URL))
2. **[krótki tytuł]** — [jednozdaniowe podsumowanie] ([źródło](URL))
3. **[krótki tytuł]** — [jednozdaniowe podsumowanie] ([źródło](URL))

## 💡 Porada dnia
[Krótka, pozytywna porada na dzień]

W sekcji wiadomości wybierz dokładnie 3 różne, najważniejsze wydarzenia.
Korzystaj wyłącznie z przekazanych nagłówków. Zachowaj URL i nazwę źródła.
Nie dopowiadaj faktów, których nie ma w danych. Jeśli wiadomości są niedostępne,
napisz to wprost zamiast tworzyć wiadomości z pamięci.`;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const isCronRequest =
    !secret || request.headers.get("authorization") === `Bearer ${secret}`;
  const auth = isCronRequest ? null : await getAuthenticatedSupabase(request);

  if (!isCronRequest && !auth) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (auth) {
    const limitResponse = await enforceDailyTokenLimit(auth.client);
    if (limitResponse) return limitResponse;
  }

  try {
    const [weather, eur, usd, worldNews] = await Promise.all([
      getWeatherData("Warszawa"),
      getExchangeRateData("EUR"),
      getExchangeRateData("USD"),
      getWorldNewsData(),
    ]);
    const currentDateTime = getCurrentDateTimeData();

    const result = await generateText({
      model: google(modelId),
      system: systemPrompt,
      prompt: `Przygotuj briefing wyłącznie na podstawie poniższych danych. Nie zmieniaj kursów, danych pogodowych ani informacji w nagłówkach. Jeśli nie masz pewnej informacji, napisz to wprost.

Data i czas:
${JSON.stringify(currentDateTime, null, 2)}

Pogoda w Warszawie:
${JSON.stringify(weather, null, 2)}

Kurs EUR:
${JSON.stringify(eur, null, 2)}

Kurs USD:
${JSON.stringify(usd, null, 2)}

Aktualne wiadomości ze świata:
${JSON.stringify(worldNews, null, 2)}`,
    });

    const admin = getSupabaseAdmin();
    const content = result.text;
    await logApiUsage({
      client: auth?.client ?? admin,
      userId: auth?.user.id ?? null,
      usage: result.usage,
      model: modelId,
      endpoint: "/api/cron/morning",
    });

    const { error } = await admin.from("briefings").insert({
      date: currentDateTime.date,
      content,
    });

    if (error) {
      throw new Error(`Nie udało się zapisać briefingu: ${error.message}`);
    }

    return Response.json({
      success: true,
      date: currentDateTime.date,
      preview: content.slice(0, 200),
    });
  } catch (error) {
    console.error("Morning cron failed:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Nieznany błąd.",
      },
      { status: 500 },
    );
  }
}
