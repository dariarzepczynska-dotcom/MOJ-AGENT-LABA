import { GoogleGenAI, Modality } from "@google/genai";
import { tool } from "ai";
import { z } from "zod";

type Note = {
  title: string;
  content: string;
  createdAt: string;
};

const notesStore = globalThis as typeof globalThis & {
  __mojAgentNotes?: Note[];
};

function getNotesStore() {
  notesStore.__mojAgentNotes ??= [];
  return notesStore.__mojAgentNotes;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nieznany blad.";
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    return {
      response: await fetch(input, {
        ...init,
        signal: controller.signal,
      }),
    };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        error: "Timeout - serwer nie odpowiedzial w 5 sekund. Sprobuj ponownie.",
      };
    }

    return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractTextFromHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function safeCalculate(expression: string) {
  const normalized = expression.replace(/,/g, ".").trim();

  if (!/^[\d\s+\-*/().%^]+$/.test(normalized)) {
    throw new Error("Dozwolone sa tylko liczby i operatory + - * / % ^ ().");
  }

  const jsExpression = normalized.replace(/\^/g, "**");
  const result = Function(`"use strict"; return (${jsExpression});`)();

  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Nie udalo sie policzyc poprawnego wyniku.");
  }

  return result;
}

function weatherDescription(code: number) {
  const descriptions: Record<number, string> = {
    0: "bezchmurnie",
    1: "glownie bezchmurnie",
    2: "czesciowe zachmurzenie",
    3: "pochmurno",
    45: "mgla",
    48: "mgla oszroniona",
    51: "lekka mzawka",
    53: "umiarkowana mzawka",
    55: "silna mzawka",
    61: "lekki deszcz",
    63: "umiarkowany deszcz",
    65: "silny deszcz",
    71: "lekki snieg",
    73: "umiarkowany snieg",
    75: "silny snieg",
    80: "lekkie przelotne opady",
    81: "umiarkowane przelotne opady",
    82: "silne przelotne opady",
    95: "burza",
    96: "burza z lekkim gradem",
    99: "burza z silnym gradem",
  };

  return descriptions[code] ?? `kod pogody ${code}`;
}

export const calculator = tool({
  description:
    "Oblicza wyrazenia matematyczne. Uzywaj do dokladnych obliczen.",
  inputSchema: z.object({
    expression: z.string().describe('Wyrazenie matematyczne, np. "15 * 247".'),
  }),
  execute: async ({ expression }) => {
    const forbidden = /\b(import|require|eval|process)\b/i;

    if (forbidden.test(expression)) {
      return { expression, error: "Wyrazenie zawiera niedozwolone znaki" };
    }

    try {
      return { expression, result: safeCalculate(expression) };
    } catch {
      return { expression, error: `Nie moge obliczyc: ${expression}` };
    }
  },
});

export const currentDateTime = tool({
  description: "Zwraca aktualna date i czas.",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();

    return {
      dateTime: new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "Europe/Warsaw",
      }).format(now),
      dayOfWeek: new Intl.DateTimeFormat("pl-PL", {
        weekday: "long",
        timeZone: "Europe/Warsaw",
      }).format(now),
      timestamp: now.toISOString(),
    };
  },
});

export const getWeather = tool({
  description: "Sprawdza aktualna pogode w podanym miescie.",
  inputSchema: z.object({
    city: z.string().min(1).describe("Nazwa miasta, np. Krakow."),
  }),
  execute: async ({ city }) => {
    const cityName = city.trim();

    if (!cityName) {
      return { error: "Podaj nazwe miasta" };
    }

    try {
      const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geocodingUrl.searchParams.set("name", cityName);
      geocodingUrl.searchParams.set("count", "1");
      geocodingUrl.searchParams.set("language", "pl");

      const geocodingResult = await fetchWithTimeout(geocodingUrl);

      if ("error" in geocodingResult) {
        return { error: geocodingResult.error };
      }

      const { response: geocodingResponse } = geocodingResult;

      if (!geocodingResponse.ok) {
        return { error: `API zwrocilo blad ${geocodingResponse.status}. Sprawdz parametry.` };
      }

      const geocoding = (await geocodingResponse.json()) as {
        results?: Array<{
          latitude: number;
          longitude: number;
          name: string;
          country?: string;
        }>;
      };
      const location = geocoding.results?.[0];

      if (!location) {
        return { error: `Nie znalazlem miasta ${cityName}. Sprawdz pisownie.` };
      }

      const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
      weatherUrl.searchParams.set("latitude", String(location.latitude));
      weatherUrl.searchParams.set("longitude", String(location.longitude));
      weatherUrl.searchParams.set(
        "current",
        "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
      );

      const weatherResult = await fetchWithTimeout(weatherUrl);

      if ("error" in weatherResult) {
        return { error: weatherResult.error };
      }

      const { response: weatherResponse } = weatherResult;

      if (!weatherResponse.ok) {
        return { error: `API zwrocilo blad ${weatherResponse.status}. Sprawdz parametry.` };
      }

      const weather = (await weatherResponse.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          wind_speed_10m?: number;
          weather_code?: number;
        };
      };
      const current = weather.current;

      if (!current) {
        return { error: `Brak aktualnej pogody dla ${location.name}.` };
      }

      return {
        city: location.country ? `${location.name}, ${location.country}` : location.name,
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        description:
          typeof current.weather_code === "number"
            ? weatherDescription(current.weather_code)
            : "brak opisu",
        source: "Open-Meteo",
      };
    } catch (error) {
      return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
    }
  },
});

export const getExchangeRate = tool({
  description: "Sprawdza kurs waluty do PLN z NBP.",
  inputSchema: z.object({
    currency: z.string().min(3).max(3).describe('Kod waluty, np. "EUR".'),
  }),
  execute: async ({ currency }) => {
    const code = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(code)) {
      return { error: "Podaj 3-literowy kod waluty (np. EUR, USD)" };
    }

    try {
      const result = await fetchWithTimeout(
        `https://api.nbp.pl/api/exchangerates/rates/a/${code}/?format=json`,
      );

      if ("error" in result) {
        return { error: result.error };
      }

      const { response } = result;

      if (response.status === 404) {
        return {
          error: `Waluta ${code} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF`,
        };
      }

      if (!response.ok) {
        return { error: `API zwrocilo blad ${response.status}. Sprawdz parametry.` };
      }

      const data = (await response.json()) as {
        rates?: Array<{ mid: number; effectiveDate: string }>;
      };
      const rate = data.rates?.[0];

      if (!rate) {
        return { error: `Brak kursu dla ${code}.` };
      }

      return {
        currency: code,
        rate: rate.mid,
        date: rate.effectiveDate,
        source: "NBP",
      };
    } catch (error) {
      return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
    }
  },
});

export const getHolidays = tool({
  description: "Sprawdza swieta panstwowe w danym kraju na dany rok.",
  inputSchema: z.object({
    countryCode: z.string().min(2).max(2).describe('Kod kraju, np. "PL".'),
    year: z.number().int().min(1900).max(2100).describe("Rok, np. 2026."),
  }),
  execute: async ({ countryCode, year }) => {
    const code = countryCode.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(code)) {
      return { error: "Podaj 2-literowy kod kraju (np. PL, DE, US)" };
    }

    try {
      const result = await fetchWithTimeout(
        `https://date.nager.at/api/v3/publicholidays/${year}/${code}`,
      );

      if ("error" in result) {
        return { error: result.error };
      }

      const { response } = result;

      if (!response.ok) {
        return {
          error: `Nie znalazlem swiat dla kraju ${code}. Popularne: PL, DE, US, GB, FR`,
        };
      }

      const holidays = (await response.json()) as Array<{
        date: string;
        localName: string;
        name: string;
      }>;

      return {
        countryCode: code,
        year,
        holidays: holidays.slice(0, 15).map((holiday) => ({
          date: holiday.date,
          localName: holiday.localName,
          name: holiday.name,
        })),
        source: "Nager.Date",
      };
    } catch (error) {
      return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
    }
  },
});

export const searchWikipedia = tool({
  description: "Wyszukuje artykul w Wikipedii i zwraca streszczenie.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Haslo lub temat do wyszukania."),
  }),
  execute: async ({ query }) => {
    async function getSummary(title: string) {
      const result = await fetchWithTimeout(
        `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      );

      if ("error" in result) {
        return { error: result.error };
      }

      const { response } = result;

      if (!response.ok) {
        if (response.status === 404) {
          return { summary: null };
        }

        return {
          error: `API zwrocilo blad ${response.status}. Sprawdz parametry.`,
        };
      }

      return {
        summary: (await response.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        thumbnail?: { source?: string };
        },
      };
    }

    try {
      const firstSummary = await getSummary(query);

      if ("error" in firstSummary) {
        return { error: firstSummary.error };
      }

      let summary = firstSummary.summary;

      if (!summary?.extract) {
        const searchUrl = new URL("https://pl.wikipedia.org/w/api.php");
        searchUrl.searchParams.set("action", "query");
        searchUrl.searchParams.set("list", "search");
        searchUrl.searchParams.set("srsearch", query);
        searchUrl.searchParams.set("format", "json");
        searchUrl.searchParams.set("origin", "*");

        const searchResult = await fetchWithTimeout(searchUrl);

        if ("error" in searchResult) {
          return { error: searchResult.error };
        }

        const { response: searchResponse } = searchResult;

        if (!searchResponse.ok) {
          return { error: `API zwrocilo blad ${searchResponse.status}. Sprawdz parametry.` };
        }

        const searchData = (await searchResponse.json()) as {
          query?: { search?: Array<{ title: string }> };
        };
        const title = searchData.query?.search?.[0]?.title;

        if (!title) {
          return { error: `Nie znalazlem hasla ${query} w Wikipedii.` };
        }

        const nextSummary = await getSummary(title);

        if ("error" in nextSummary) {
          return { error: nextSummary.error };
        }

        summary = nextSummary.summary;
      }

      if (!summary?.extract) {
        return { error: `Nie znalazlem streszczenia dla ${query}.` };
      }

      return {
        title: summary.title ?? query,
        summary: summary.extract.slice(0, 1000),
        url: summary.content_urls?.desktop?.page,
        thumbnail: summary.thumbnail?.source,
        source: "Wikipedia",
      };
    } catch (error) {
      return { error: `Blad polaczenia: ${getErrorMessage(error)}` };
    }
  },
});

export const saveNote = tool({
  description: "Zapisuje notatke w pamieci agenta.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Tytul notatki."),
    content: z.string().min(1).describe("Tresc notatki."),
  }),
  execute: async ({ title, content }) => {
    getNotesStore().push({
      title,
      content,
      createdAt: new Date().toISOString(),
    });

    return { saved: true, title };
  },
});

export const getNotes = tool({
  description: "Pobiera wszystkie zapisane notatki.",
  inputSchema: z.object({}),
  execute: async () => getNotesStore(),
});

export const readWebPage = tool({
  description:
    "Pobiera i czyta zawartosc strony internetowej. Uzywaj gdy trzeba przeczytac konkretny URL.",
  inputSchema: z.object({
    url: z.string().url().describe("Pelny adres URL strony."),
  }),
  execute: async ({ url }) => {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      return { url, error: "Nieprawidlowy adres URL." };
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { url, error: "Obslugiwane sa tylko adresy http i https." };
    }

    try {
      const result = await fetchWithTimeout(parsedUrl, {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; MojAgent/1.0)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      if ("error" in result) {
        return { url, error: result.error };
      }

      const { response } = result;

      if (!response.ok) {
        return {
          url,
          error: `API zwrocilo blad ${response.status}. Sprawdz parametry.`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const text = contentType.includes("text/html")
        ? extractTextFromHtml(body)
        : body.replace(/\s+/g, " ").trim();

      return {
        url,
        contentType,
        text: text.slice(0, 3000) || "Strona nie zawiera czytelnego tekstu.",
      };
    } catch (error) {
      return {
        url,
        error: `Blad polaczenia: ${getErrorMessage(error)}`,
      };
    }
  },
});

export const generateImage = tool({
  description:
    "Generuje obraz na podstawie opisu. Uzywaj gdy uzytkownik prosi o logo, grafike lub ilustracje.",
  inputSchema: z.object({
    prompt: z.string().min(1).describe("Opis obrazu do wygenerowania."),
  }),
  execute: async ({ prompt }) => {
    const apiKey =
      process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return {
        prompt,
        error:
          "Brakuje GOOGLE_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji serwera.",
      };
    }

    const ai = new GoogleGenAI({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          abortSignal: controller.signal,
        },
      });
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((part) => part.inlineData?.data);
      const text = parts
        .filter((part) => part.text)
        .map((part) => part.text)
        .join("\n")
        .trim();

      if (!imagePart?.inlineData?.data) {
        return {
          prompt,
          error: "Model odpowiedzial, ale nie zwrocil obrazu.",
        };
      }

      const mimeType = imagePart.inlineData.mimeType ?? "image/png";

      return {
        prompt,
        image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
        text,
      };
    } catch (error) {
      return { prompt, error: `Blad API: ${getErrorMessage(error)}` };
    } finally {
      clearTimeout(timeout);
    }
  },
});
