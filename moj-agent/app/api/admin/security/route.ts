import type { User } from "@supabase/supabase-js";
import { DAILY_TOKEN_LIMIT } from "@/lib/api-usage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type UsageRow = {
  user_id: string;
  tokens_today: number | string;
  tokens_week: number | string;
};

type BurstRow = {
  user_id: string;
  message_count: number | string;
  last_message_at: string;
};

function isAdmin(user: User) {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return (
    user.app_metadata?.role === "admin" ||
    (Boolean(user.email) &&
      configuredEmails.includes(user.email!.toLowerCase()))
  );
}

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!token) {
    return Response.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } =
    await admin.auth.getUser(token);

  if (authError || !authData.user) {
    console.error("Nie udało się zweryfikować sesji administratora:", authError);
    return Response.json(
      { error: "Sesja jest nieprawidłowa lub wygasła. Zaloguj się ponownie." },
      { status: 401 },
    );
  }

  if (!isAdmin(authData.user)) {
    return Response.json(
      {
        error:
          "Brak uprawnień administratora. Ustaw app_metadata.role na admin lub dodaj e-mail do ADMIN_EMAILS.",
      },
      { status: 403 },
    );
  }

  try {
    const [
      { data: blockedRows, error: blockedError },
      { count: blockedCount, error: blockedCountError },
      usageResult,
      burstResult,
    ] = await Promise.all([
        admin
          .from("message_logs")
          .select("id, user_id, message, block_reason, created_at")
          .eq("blocked", true)
          .order("created_at", { ascending: false })
          .limit(50),
        admin
          .from("message_logs")
          .select("id", { count: "exact", head: true })
          .eq("blocked", true),
        admin.rpc("get_admin_security_usage"),
        admin.rpc("get_admin_security_bursts"),
      ]);

    if (
      blockedError ||
      blockedCountError ||
      usageResult.error ||
      burstResult.error
    ) {
      console.error("Błąd danych panelu bezpieczeństwa:", {
        blockedError,
        blockedCountError,
        usageError: usageResult.error,
        burstError: burstResult.error,
      });
      return Response.json(
        { error: "Nie udało się pobrać danych bezpieczeństwa." },
        { status: 500 },
      );
    }

    const usageRows = (usageResult.data ?? []) as UsageRow[];
    const burstRows = (burstResult.data ?? []) as BurstRow[];
    const userIds = [
      ...new Set([
        ...(blockedRows ?? []).map((row) => row.user_id),
        ...usageRows.map((row) => row.user_id),
        ...burstRows.map((row) => row.user_id),
      ]),
    ];
    const userResults = await Promise.all(
      userIds.map((id) => admin.auth.admin.getUserById(id)),
    );
    const emails = new Map(
      userResults.map((result, index) => [
        userIds[index],
        result.data.user?.email ?? "Nieznany użytkownik",
      ]),
    );

    const usage = usageRows
      .map((row) => ({
        userId: row.user_id,
        email: emails.get(row.user_id) ?? "Nieznany użytkownik",
        tokensToday: asNumber(row.tokens_today),
        tokensWeek: asNumber(row.tokens_week),
        limitPercent: Math.min(
          100,
          Math.round((asNumber(row.tokens_today) / DAILY_TOKEN_LIMIT) * 100),
        ),
      }))
      .sort((a, b) => b.tokensWeek - a.tokensWeek);

    const blockedMessages = (blockedRows ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: emails.get(row.user_id) ?? "Nieznany użytkownik",
      message: row.message ?? "Brak zapisanej treści",
      reason: row.block_reason ?? "Filtr bezpieczeństwa",
      createdAt: row.created_at,
    }));

    const alerts = [
      ...usage
        .filter((row) => row.limitPercent >= 80)
        .map((row) => ({
          id: `limit-${row.userId}`,
          type: "limit" as const,
          title: "Wysokie zużycie limitu",
          detail: `${row.email} wykorzystał(a) ${row.limitPercent}% dziennego limitu.`,
          createdAt: new Date().toISOString(),
        })),
      ...burstRows.map((row) => ({
        id: `burst-${row.user_id}`,
        type: "burst" as const,
        title: "Nagły wzrost aktywności",
        detail: `${emails.get(row.user_id) ?? "Nieznany użytkownik"} wysłał(a) ${asNumber(row.message_count)} wiadomości w 10 minut.`,
        createdAt: row.last_message_at,
      })),
      ...blockedMessages.map((row) => ({
        id: `blocked-${row.id}`,
        type: "blocked" as const,
        title: "Wiadomość zablokowana przez filtr",
        detail: `${row.email}: ${row.reason}`,
        createdAt: row.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const totalToday = usage.reduce((sum, row) => sum + row.tokensToday, 0);
    const totalWeek = usage.reduce((sum, row) => sum + row.tokensWeek, 0);

    return Response.json(
      {
        blockedMessages,
        topUsers: usage.slice(0, 5),
        alerts,
        stats: {
          tokensToday: totalToday,
          tokensWeek: totalWeek,
          blockedCount: blockedCount ?? 0,
          averagePerUser: usage.length
            ? Math.round(totalWeek / usage.length)
            : 0,
        },
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Błąd panelu bezpieczeństwa:", error);
    return Response.json(
      { error: "Panel bezpieczeństwa nie jest jeszcze skonfigurowany." },
      { status: 500 },
    );
  }
}
