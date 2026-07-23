import { google } from "@ai-sdk/google";
import { generateObject, generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { getAuthenticatedSupabase } from "@/lib/server-supabase";

const imagePattern = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/;

const calculator = tool({
  description: "Oblicza proporcje, przelicza jednostki i porządkuje wymiary produktu.",
  inputSchema: z.object({ expression: z.string() }),
  execute: async ({ expression }) => {
    const normalized = expression.replace(/,/g, ".").replace(/\^/g, "**");
    if (!/^[\d\s+\-*/().%*]+$/.test(normalized)) return { error: "Niedozwolone wyrażenie." };
    const result = Function(`"use strict"; return (${normalized})`)();
    return Number.isFinite(result) ? { result } : { error: "Nieprawidłowy wynik." };
  },
});

const readWebPage = tool({
  description: "Czyta stronę WWW, zwłaszcza fikartki.pl, aby sprawdzić ton, kategorie i karty produktów.",
  inputSchema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return { error: "Nieobsługiwany protokół." };
    const response = await fetch(parsed, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; FikartkiProductAgent/1.0)" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const html = await response.text();
    return {
      url,
      text: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 5000),
    };
  },
});

const searchWikipedia = tool({
  description: "Wyszukuje w Wikipedii materiał lub technikę rękodzielniczą.",
  inputSchema: z.object({ query: z.string().min(2) }),
  execute: async ({ query }) => {
    const endpoint = new URL("https://pl.wikipedia.org/w/api.php");
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("list", "search");
    endpoint.searchParams.set("srsearch", query);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const data = await response.json();
    return { results: data.query?.search?.slice(0, 3) ?? [] };
  },
});

const productSchema = z.object({
  productName: z.string(),
  shortDescription: z.string(),
  fullDescription: z.string(),
  materials: z.array(z.string()),
  dimensions: z.string(),
  productionMethod: z.string(),
  leadTime: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  safetyInfo: z.string(),
  seoTitle: z.string(),
  metaDescription: z.string(),
  focusKeyphrase: z.string(),
  uncertainties: z.array(z.string()),
});

function sanitizeWooHtml(value: string) {
  return value
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?!\/?(?:h2|h3|p|ul|li|strong)\b)[^>]+>/gi, "")
    .replace(/<(h2|h3|p|ul|li|strong)\b[^>]*>/gi, "<$1>");
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase(request);
  if (!auth) return Response.json({ error: "Brak autoryzacji." }, { status: 401 });

  try {
    const body = await request.json();
    const image = typeof body.image === "string" ? body.image : "";
    if (!imagePattern.test(image)) {
      return Response.json({ error: "Dodaj obraz PNG, JPG lub WEBP." }, { status: 400 });
    }
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 1500) : "";

    const research = await generateText({
      model: google("gemini-3.1-flash-lite"),
      system: `Jesteś researcherem e-commerce marki Fikartki. Sprawdź fikartki.pl narzędziem readWebPage.
Używaj Google Search do aktualnych kategorii, readWebPage do źródeł, calculator do wymiarów
i searchWikipedia do nieznanych technik. Nie wymyślaj cech, których nie widać i nie podano.
Użytkownik napisał GDRP, ale dla produktu chodzi najpewniej o GPSR/GPSD — przygotuj bezpieczeństwo produktu.
Główne kategorie: Kartki, Zaproszenia, Biżuteria, Dekoracje, Produkty cyfrowe.`,
      prompt: `Zbierz kontekst do opisu produktu ze zdjęcia. Notatki: ${notes || "brak"}`,
      tools: {
        ...(process.env.ENABLE_SEARCH_GROUNDING === "true"
          ? { google_search: google.tools.googleSearch({}) }
          : {}),
        readWebPage,
        calculator,
        searchWikipedia,
      },
      stopWhen: isStepCount(4),
    });

    const result = await generateObject({
      model: google("gemini-3.1-flash-lite"),
      schema: productSchema,
      system: `Jesteś copywriterem SEO Fikartki.pl. Pisz ciepłym językiem polskiej marki handmade.
Zwróć opis gotowy do WordPress/WooCommerce. W polach HTML używaj tylko h2, h3, p, ul, li, strong.
Pełny opis ma zawierać korzyści, materiały, wymiary, wykonanie, personalizację, czas realizacji i GPSR.
Nie przedstawiaj przypuszczeń jako faktów. Nieznane dane oznacz "do uzupełnienia" i dodaj do uncertainties.
Meta description: 140–160 znaków. SEO title: maksymalnie 60 znaków.`,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Notatki: ${notes || "brak"}\nResearch:\n${research.text}` },
          { type: "image", image },
        ],
      }],
    });

    return Response.json({
      ...result.object,
      shortDescription: sanitizeWooHtml(result.object.shortDescription),
      fullDescription: sanitizeWooHtml(result.object.fullDescription),
      safetyInfo: sanitizeWooHtml(result.object.safetyInfo),
    });
  } catch (error) {
    console.error("Błąd generatora opisów:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Nie udało się wygenerować opisu." },
      { status: 500 },
    );
  }
}
