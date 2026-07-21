const embeddingModel = "gemini-embedding-2";
const expectedDimensions = 768;

type EmbedContentResponse = {
  embedding?: {
    values?: unknown;
  };
  error?: {
    message?: string;
  };
};

export async function generateEmbedding(text: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error("Brakuje GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji serwera.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${embeddingModel}`,
        content: { parts: [{ text }] },
        output_dimensionality: expectedDimensions,
      }),
      cache: "no-store",
    },
  );
  const data = (await response.json()) as EmbedContentResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Google Embedding API zwróciło błąd.");
  }

  const values = data.embedding?.values;

  if (
    !Array.isArray(values) ||
    values.length !== expectedDimensions ||
    !values.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error("Embedding API nie zwróciło wektora o wymiarze 768.");
  }

  return values as number[];
}
