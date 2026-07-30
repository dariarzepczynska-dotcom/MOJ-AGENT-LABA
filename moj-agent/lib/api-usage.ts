import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_TOKEN_LIMIT = 10_000;
export const TOKEN_LIMIT_MESSAGE =
  "Dzienny limit tokenów (10k) został wyczerpany. Wróć jutro!";

type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

function normalizeTokenCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

export async function enforceDailyTokenLimit(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_daily_api_usage");

  if (error) {
    console.error("Nie udało się sprawdzić dziennego limitu tokenów:", error);
    return Response.json(
      { error: "Nie udało się sprawdzić dziennego limitu tokenów." },
      { status: 503 },
    );
  }

  const usedTokens =
    typeof data === "number"
      ? data
      : Array.isArray(data)
        ? Number(data[0]?.get_daily_api_usage ?? data[0] ?? 0)
        : Number(data ?? 0);

  if (usedTokens >= DAILY_TOKEN_LIMIT) {
    return Response.json(
      { error: TOKEN_LIMIT_MESSAGE },
      { status: 429 },
    );
  }

  return null;
}

export async function logApiUsage({
  client,
  userId,
  usage,
  model,
  endpoint,
}: {
  client: SupabaseClient;
  userId: string | null;
  usage: TokenUsage;
  model: string;
  endpoint: string;
}) {
  const { error } = await client.from("api_usage").insert({
    user_id: userId,
    tokens_input: normalizeTokenCount(usage.inputTokens),
    tokens_output: normalizeTokenCount(usage.outputTokens),
    model,
    endpoint,
  });

  if (error) {
    console.error("Nie udało się zapisać zużycia tokenów:", error);
  }
}

export function createApiUsageOnFinish({
  client,
  userId,
  model,
  endpoint,
}: {
  client: SupabaseClient;
  userId: string;
  model: string;
  endpoint: string;
}) {
  return ({ usage }: { usage: TokenUsage }) =>
    logApiUsage({ client, userId, usage, model, endpoint });
}
