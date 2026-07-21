import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";

type GenerateImageBody = {
  prompt?: unknown;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nieznany blad generowania obrazu.";
}

function parseApiError(error: unknown) {
  const message = getErrorMessage(error);

  try {
    const parsed = JSON.parse(message) as {
      error?: { code?: number; message?: string; status?: string };
    };

    return parsed.error;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  let body: GenerateImageBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Nieprawidlowe body requestu." },
      { status: 400 },
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "Prompt jest wymagany." },
      { status: 400 },
    );
  }

  const apiKey =
    process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Brakuje GOOGLE_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji serwera.",
      },
      { status: 500 },
    );
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
      return NextResponse.json(
        {
          error:
            "Model odpowiedzial, ale nie zwrocil obrazu. Sprobuj zmienic prompt.",
        },
        { status: 500 },
      );
    }

    const mimeType = imagePart.inlineData.mimeType ?? "image/png";

    return NextResponse.json({
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      text,
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const apiError = parseApiError(error);

    if (apiError?.code === 429 || apiError?.status === "RESOURCE_EXHAUSTED") {
      return NextResponse.json(
        {
          error:
            "Limit zapytan dla modelu obrazowego zostal przekroczony albo free tier nie jest dostepny dla tego projektu/modelu. Sprobuj pozniej albo sprawdz limity w Google AI Studio.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: isTimeout
          ? "Generowanie przekroczylo limit 30 sekund. Sprobuj ponownie."
          : `Blad API: ${apiError?.message ?? getErrorMessage(error)}`,
      },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
