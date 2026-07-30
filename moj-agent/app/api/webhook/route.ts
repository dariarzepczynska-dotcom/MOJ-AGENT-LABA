import { google } from "@ai-sdk/google";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { logApiUsage } from "@/lib/api-usage";

export const dynamic = "force-dynamic";
const modelId = "gemini-3.1-flash-lite";

const eventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("feedback"),
    data: z.object({
      customer: z.string().trim().min(1).max(200),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1).max(5000),
    }),
  }),
  z.object({
    type: z.literal("alert"),
    data: z.object({
      service: z.string().trim().min(1).max(200),
      status: z.string().trim().min(1).max(100),
      since: z.iso.datetime(),
    }),
  }),
  z.object({
    type: z.literal("order"),
    data: z.object({
      product: z.string().trim().min(1).max(300),
      customer: z.email(),
      amount: z.number().nonnegative(),
    }),
  }),
]);

type WebhookEvent = z.infer<typeof eventSchema>;

const prompts: Record<WebhookEvent["type"], string> = {
  feedback: `Przeanalizuj opinię klienta. Podaj:
- sentyment (pozytywny, neutralny lub negatywny),
- priorytet (niski, średni lub wysoki) z krótkim uzasadnieniem,
- krótką, profesjonalną sugestię odpowiedzi dla klienta.`,
  alert: `Przeanalizuj alert techniczny. Podaj:
- severity (low, medium, high lub critical) z krótkim uzasadnieniem,
- rekomendowane działania w kolejności wykonania.
Nie twierdź, że działania zostały już wykonane.`,
  order: `Przeanalizuj zamówienie. Potwierdź przyjęcie danych i przygotuj krótkie
podsumowanie produktu, klienta oraz kwoty. Nie twierdź, że płatność została zaksięgowana.`,
};

function isAuthorized(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  return !secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Nieprawidłowy format JSON." },
      { status: 400 },
    );
  }

  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: "Nieprawidłowe dane zdarzenia.",
        details: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const event = parsed.data;
    const result = await generateText({
      model: google(modelId),
      system: `Jesteś agentem analizującym zdarzenia webhook. Odpowiadaj zwięźle
i wyłącznie po polsku. Opieraj się tylko na przekazanych danych; nie dopowiadaj faktów.`,
      prompt: `${prompts[event.type]}

Typ zdarzenia: ${event.type}
Dane:
${JSON.stringify(event.data, null, 2)}`,
    });

    const supabase = getSupabaseAdmin();
    const analysis = result.text;
    await logApiUsage({
      client: supabase,
      userId: null,
      usage: result.usage,
      model: modelId,
      endpoint: "/api/webhook",
    });
    const { data: savedEvent, error } = await supabase
      .from("webhook_events")
      .insert({
        type: event.type,
        data: event.data,
        analysis,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Nie udało się zapisać zdarzenia: ${error.message}`);
    }

    return Response.json({
      success: true,
      analysis,
      event_id: savedEvent.id,
    });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się przetworzyć zdarzenia.",
      },
      { status: 500 },
    );
  }
}
