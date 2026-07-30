"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

type SecurityData = {
  blockedMessages: Array<{
    id: string;
    email: string;
    message: string;
    reason: string;
    createdAt: string;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    tokensToday: number;
    tokensWeek: number;
    limitPercent: number;
  }>;
  alerts: Array<{
    id: string;
    type: "limit" | "burst" | "blocked";
    title: string;
    detail: string;
    createdAt: string;
  }>;
  stats: {
    tokensToday: number;
    tokensWeek: number;
    blockedCount: number;
    averagePerUser: number;
  };
  generatedAt: string;
};

const numberFormatter = new Intl.NumberFormat("pl-PL");

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function shorten(value: string, length = 82) {
  return value.length > length ? `${value.slice(0, length).trim()}…` : value;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/10 bg-black/10 px-4 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

async function fetchSecurityData() {
  const response = await authFetch("/api/admin/security", {
    cache: "no-store",
  });
  const payload = (await response.json()) as SecurityData & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Nie udało się pobrać danych.");
  }
  return payload;
}

export default function SecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSecurityData());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać danych.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchSecurityData()
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Nie udało się pobrać danych.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = [
    {
      label: "Tokeny dziś",
      value: data ? numberFormatter.format(data.stats.tokensToday) : "—",
      accent: "text-cyan-300",
    },
    {
      label: "Tokeny w tym tygodniu",
      value: data ? numberFormatter.format(data.stats.tokensWeek) : "—",
      accent: "text-violet-300",
    },
    {
      label: "Zablokowane",
      value: data ? numberFormatter.format(data.stats.blockedCount) : "—",
      accent: "text-rose-300",
    },
    {
      label: "Średnio / użytkownik",
      value: data ? numberFormatter.format(data.stats.averagePerUser) : "—",
      accent: "text-emerald-300",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07090d] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(22,163,174,0.13),transparent_32%),radial-gradient(circle_at_95%_10%,rgba(244,63,94,0.10),transparent_28%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,auto,40px_40px,40px_40px]"
      />

      <div className="relative mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0d1118]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              Monitoring aktywny
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              🛡️ Panel bezpieczeństwa
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Zablokowane próby, wykorzystanie limitów i sygnały wymagające
              uwagi w jednym miejscu.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span className="hidden text-xs text-slate-500 sm:inline">
                Aktualizacja {formatDate(data.generatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? "Odświeżanie…" : "Odśwież dane"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"
          >
            {error}
          </div>
        )}

        <section aria-labelledby="stats-title" className="mb-6">
          <h2 id="stats-title" className="sr-only">
            Statystyki
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-xl border border-white/10 bg-[#0d1118]/90 p-5 shadow-xl shadow-black/20"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {stat.label}
                </p>
                <p className={`mt-3 text-3xl font-semibold ${stat.accent}`}>
                  {loading ? (
                    <span className="block h-9 w-24 animate-pulse rounded bg-white/10" />
                  ) : (
                    stat.value
                  )}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/10 bg-[#0d1118]/90 p-5 shadow-xl shadow-black/20">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  ⚠️ Zablokowane wiadomości
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ostatnie próby odrzucone przez walidację
                </p>
              </div>
              <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
                {data?.blockedMessages.length ?? 0}
              </span>
            </div>

            {loading ? (
              <EmptyState>Wczytywanie logów…</EmptyState>
            ) : !data?.blockedMessages.length ? (
              <EmptyState>Brak zablokowanych wiadomości. To dobry znak.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4 font-medium">Użytkownik</th>
                      <th className="pb-3 pr-4 font-medium">Wiadomość</th>
                      <th className="pb-3 pr-4 font-medium">Powód</th>
                      <th className="pb-3 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.blockedMessages.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="py-4 pr-4 font-medium text-slate-200">
                          {row.email}
                        </td>
                        <td
                          className="max-w-xs py-4 pr-4 text-slate-400"
                          title={row.message}
                        >
                          {shorten(row.message)}
                        </td>
                        <td className="py-4 pr-4">
                          <span className="rounded-md bg-rose-400/10 px-2 py-1 text-xs text-rose-200">
                            {row.reason}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-4 text-slate-500">
                          {formatDate(row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d1118]/90 p-5 shadow-xl shadow-black/20">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">🔴 Alerty</h2>
              <p className="mt-1 text-sm text-slate-500">
                Podejrzane zachowania z ostatnich zdarzeń
              </p>
            </div>
            {loading ? (
              <EmptyState>Analizowanie aktywności…</EmptyState>
            ) : !data?.alerts.length ? (
              <EmptyState>Brak aktywnych alertów.</EmptyState>
            ) : (
              <div className="max-h-[470px] space-y-3 overflow-y-auto pr-1">
                {data.alerts.map((alert) => (
                  <article
                    key={alert.id}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          alert.type === "limit"
                            ? "bg-amber-400"
                            : alert.type === "burst"
                              ? "bg-violet-400"
                              : "bg-rose-400"
                        }`}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-100">
                          {alert.title}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-slate-400">
                          {alert.detail}
                        </p>
                        <time className="mt-2 block text-xs text-slate-600">
                          {formatDate(alert.createdAt)}
                        </time>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#0d1118]/90 p-5 shadow-xl shadow-black/20">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              📊 Top 5 użytkowników po zużyciu
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ranking według liczby tokenów w bieżącym tygodniu
            </p>
          </div>
          {loading ? (
            <EmptyState>Liczenie zużycia…</EmptyState>
          ) : !data?.topUsers.length ? (
            <EmptyState>Brak zarejestrowanego zużycia.</EmptyState>
          ) : (
            <div className="grid gap-3 lg:grid-cols-5">
              {data.topUsers.map((user, index) => (
                <article
                  key={user.userId}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-cyan-300">
                      #{index + 1}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        user.limitPercent >= 80
                          ? "text-rose-300"
                          : "text-slate-400"
                      }`}
                    >
                      {user.limitPercent}% limitu
                    </span>
                  </div>
                  <p
                    className="mt-3 truncate text-sm font-semibold text-white"
                    title={user.email}
                  >
                    {user.email}
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${
                        user.limitPercent >= 80
                          ? "bg-rose-400"
                          : "bg-cyan-400"
                      }`}
                      style={{ width: `${user.limitPercent}%` }}
                    />
                  </div>
                  <dl className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Dziś</dt>
                      <dd className="font-medium text-slate-200">
                        {numberFormatter.format(user.tokensToday)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Tydzień</dt>
                      <dd className="font-medium text-slate-200">
                        {numberFormatter.format(user.tokensWeek)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
