import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import {
  getCurrentDateTimeData,
  getExchangeRateData,
  getWeatherData,
} from "@/app/lib/react-tools";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

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

## 💡 Porada dnia
[Krótka, pozytywna porada na dzień]`;

async function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization === `Bearer ${secret}`) {
    return true;
  }

  return Boolean(await getAuthenticatedSupabase(request));
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [weather, eur, usd] = await Promise.all([
      getWeatherData("Warszawa"),
      getExchangeRateData("EUR"),
      getExchangeRateData("USD"),
    ]);
    const currentDateTime = getCurrentDateTimeData();

    const { text: content } = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: systemPrompt,
      prompt: `Przygotuj briefing wyłącznie na podstawie poniższych danych. Nie zmieniaj kursów ani danych pogodowych. Jeśli nie masz pewnej informacji, napisz to wprost.

Data i czas:
${JSON.stringify(currentDateTime, null, 2)}

Pogoda w Warszawie:
${JSON.stringify(weather, null, 2)}

Kurs EUR:
${JSON.stringify(eur, null, 2)}

Kurs USD:
${JSON.stringify(usd, null, 2)}`,
    });

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("briefings").insert({
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
