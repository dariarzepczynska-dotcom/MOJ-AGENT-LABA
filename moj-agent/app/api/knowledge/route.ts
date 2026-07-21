import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { findKnowledge } from "@/app/lib/knowledge-tool";

type DocumentChunk = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Brakuje konfiguracji Supabase.");
  }

  return createClient(url, key);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nieznany błąd serwera.";
}

export async function GET(request: Request) {
  try {
    const title = new URL(request.url).searchParams.get("title")?.trim();
    let query = getSupabaseClient()
      .from("documents")
      .select("id, title, content, metadata, created_at")
      .order("created_at", { ascending: false });

    if (title) {
      query = query.eq("title", title);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const chunks = (data ?? []) as DocumentChunk[];
    const grouped = new Map<
      string,
      { title: string; chunks: number; created_at: string | null }
    >();

    for (const chunk of chunks) {
      const document = grouped.get(chunk.title);

      if (document) {
        document.chunks += 1;
      } else {
        grouped.set(chunk.title, {
          title: chunk.title,
          chunks: 1,
          created_at: chunk.created_at,
        });
      }
    }

    return NextResponse.json({
      documents: Array.from(grouped.values()),
      chunks: title ? chunks : [],
      total_chunks: chunks.length,
      total_documents: grouped.size,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Pytanie jest wymagane." },
        { status: 400 },
      );
    }

    return NextResponse.json(await findKnowledge(query));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
