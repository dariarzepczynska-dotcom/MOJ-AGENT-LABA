import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json({ error: "Pole text jest wymagane." }, { status: 400 });
    }

    const embedding = await generateEmbedding(text);

    return NextResponse.json({ embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się wygenerować embeddingu.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
