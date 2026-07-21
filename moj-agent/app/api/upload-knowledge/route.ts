import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { splitIntoChunks } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/embeddings";

type DocumentRow = {
  title: string;
  created_at: string | null;
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Brakuje konfiguracji Supabase.");
  }

  return createClient(url, key);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nieznany błąd serwera.";
}

export async function GET() {
  try {
    const { data, error } = await getSupabaseClient()
      .from("documents")
      .select("title, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const grouped = new Map<string, { title: string; chunks: number; created_at: string | null }>();

    for (const row of (data ?? []) as DocumentRow[]) {
      const existing = grouped.get(row.title);

      if (existing) {
        existing.chunks += 1;
      } else {
        grouped.set(row.title, { title: row.title, chunks: 1, created_at: row.created_at });
      }
    }

    return NextResponse.json({ documents: Array.from(grouped.values()) });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Tytuł jest wymagany." }, { status: 400 });
    }

    const { error } = await getSupabaseClient().from("documents").delete().eq("title", title);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let title: string;
  let chunks: string[];

  try {
    const body = (await request.json()) as { title?: unknown; content?: unknown };
    title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!title || !content) {
      return NextResponse.json(
        { error: "Tytuł i treść dokumentu są wymagane." },
        { status: 400 },
      );
    }

    chunks = splitIntoChunks(content);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (value: object) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));

      try {
        const supabase = getSupabaseClient();

        for (let index = 0; index < chunks.length; index += 1) {
          send({ type: "progress", current: index + 1, total: chunks.length });
          const embedding = await generateEmbedding(chunks[index]);
          const { error } = await supabase.from("documents").insert({
            title,
            content: chunks[index],
            embedding,
            metadata: {
              source: title,
              chunk_index: index,
              total_chunks: chunks.length,
            },
          });

          if (error) {
            throw error;
          }
        }

        send({ type: "complete", success: true, chunks_saved: chunks.length });
      } catch (error) {
        send({ type: "error", error: errorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
