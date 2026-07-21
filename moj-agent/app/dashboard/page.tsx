"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type WeatherData = {
  city: string;
  temperature: number;
  windSpeed: number;
  humidity: number;
  weatherCode: number;
  updatedAt: Date;
};

type ExchangeRate = {
  code: "EUR" | "USD";
  rate: number;
  delta: number | null;
  effectiveDate: string;
  updatedAt: Date;
};

type Holiday = {
  date: string;
  localName: string;
  name: string;
};

type DashboardState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
};

const quickActions = [
  { href: "/travel", icon: "MAP", label: "Zaplanuj podroz" },
  { href: "/react", icon: "LOOP", label: "Agent ReAct" },
  { href: "/chat", icon: "CHAT", label: "Chat z agentem" },
  { href: "/think", icon: "MIND", label: "Tryb myslenia" },
  { href: "/generate", icon: "ART", label: "Generator grafik" },
  { href: "/fewshot", icon: "BOOK", label: "Slownik AI" },
];

const initialWeather: DashboardState<WeatherData> = {
  data: null,
  isLoading: true,
  error: null,
};

const initialRates: DashboardState<ExchangeRate[]> = {
  data: null,
  isLoading: true,
  error: null,
};

const initialHolidays: DashboardState<Holiday[]> = {
  data: null,
  isLoading: true,
  error: null,
};

function formatTime(date?: Date) {
  if (!date) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function daysUntil(date: string) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${date}T00:00:00`);
  const diff = target.getTime() - start.getTime();

  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function formatHolidayDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function weatherLabel(code: number) {
  if (code === 0) return "Slonecznie";
  if ([1, 2, 3].includes(code)) return "Czesciowe zachmurzenie";
  if ([45, 48].includes(code)) return "Mgla";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Deszcz";
  if ([71, 73, 75, 85, 86].includes(code)) return "Snieg";
  if ([95, 96, 99].includes(code)) return "Burza";

  return "Warunki zmienne";
}

async function fetchWeather(): Promise<WeatherData> {
  const response = await fetch(
    "https://api.open-meteo.com/v1/forecast?latitude=51.7592&longitude=19.4560&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Europe%2FWarsaw",
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Nie udalo sie pobrac pogody");
  }

  const payload = await response.json();
  const current = payload.current;

  return {
    city: "Lodz",
    temperature: Math.round(current.temperature_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    humidity: Math.round(current.relative_humidity_2m),
    weatherCode: Number(current.weather_code),
    updatedAt: new Date(),
  };
}

async function fetchRate(code: "EUR" | "USD"): Promise<ExchangeRate> {
  const response = await fetch(
    `https://api.nbp.pl/api/exchangerates/rates/a/${code}/last/2/?format=json`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Nie udalo sie pobrac kursu ${code}`);
  }

  const payload = await response.json();
  const rates = payload.rates as Array<{ mid: number; effectiveDate: string }>;
  const latest = rates[rates.length - 1];
  const previous = rates.length > 1 ? rates[rates.length - 2] : null;

  return {
    code,
    rate: latest.mid,
    delta: previous ? latest.mid - previous.mid : null,
    effectiveDate: latest.effectiveDate,
    updatedAt: new Date(),
  };
}

async function fetchHolidays(): Promise<Holiday[]> {
  const response = await fetch(
    "https://date.nager.at/api/v3/publicholidays/2026/PL",
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error("Nie udalo sie pobrac swiat");
  }

  const payload = (await response.json()) as Holiday[];
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return payload
    .filter((holiday) => new Date(`${holiday.date}T00:00:00`) >= start)
    .slice(0, 4);
}

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-label="Ladowanie">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 animate-pulse rounded bg-white/15"
          style={{ width: `${92 - index * 14}%` }}
        />
      ))}
    </div>
  );
}

function Card({
  title,
  icon,
  gradient,
  delay,
  updatedAt,
  isLoading,
  error,
  children,
}: {
  title: string;
  icon: string;
  gradient: string;
  delay: number;
  updatedAt?: Date;
  isLoading?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`dashboard-card rounded-lg border border-white/12 bg-gradient-to-br ${gradient} p-5 shadow-2xl shadow-black/20 backdrop-blur-xl`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
            {title}
          </p>
          <p className="mt-1 text-xs text-white/45">
            Ostatnia aktualizacja: {formatTime(updatedAt)}
          </p>
        </div>
        <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 font-mono text-[10px] font-semibold text-white/80">
          {icon}
        </span>
      </div>
      {isLoading ? <Skeleton lines={4} /> : error ? <p className="text-sm text-red-100">{error}</p> : children}
    </section>
  );
}

export default function DashboardPage() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(initialWeather);
  const [rates, setRates] = useState(initialRates);
  const [holidays, setHolidays] = useState(initialHolidays);

  const loadWeather = useCallback(async () => {
    setWeather((current) => ({ ...current, isLoading: !current.data, error: null }));
    try {
      const data = await fetchWeather();
      setWeather({ data, isLoading: false, error: null });
    } catch (error) {
      setWeather((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : "Blad pobierania pogody",
      }));
    }
  }, []);

  const loadRates = useCallback(async () => {
    setRates((current) => ({ ...current, isLoading: !current.data, error: null }));
    try {
      const data = await Promise.all([fetchRate("EUR"), fetchRate("USD")]);
      setRates({ data, isLoading: false, error: null });
    } catch (error) {
      setRates((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : "Blad pobierania kursow",
      }));
    }
  }, []);

  const loadHolidays = useCallback(async () => {
    setHolidays((current) => ({ ...current, isLoading: !current.data, error: null }));
    try {
      const data = await fetchHolidays();
      setHolidays({ data, isLoading: false, error: null });
    } catch (error) {
      setHolidays((current) => ({
        ...current,
        isLoading: false,
        error: error instanceof Error ? error.message : "Blad pobierania swiat",
      }));
    }
  }, []);

  const refreshAll = useCallback(() => {
    setNow(new Date());
    void Promise.all([loadWeather(), loadRates(), loadHolidays()]);
  }, [loadWeather, loadRates, loadHolidays]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    const weatherRefresh = window.setInterval(loadWeather, 15 * 60_000);
    const ratesRefresh = window.setInterval(loadRates, 60 * 60_000);

    return () => {
      window.clearInterval(clock);
      window.clearInterval(weatherRefresh);
      window.clearInterval(ratesRefresh);
    };
  }, [loadWeather, loadRates]);

  const nextHoliday = holidays.data?.[0];
  const oldestRateDate = useMemo(() => {
    if (!rates.data?.length) return null;
    return rates.data.map((rate) => rate.effectiveDate).sort()[0];
  }, [rates.data]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(5,5,6,0.97),rgba(8,14,18,0.94)_45%,rgba(5,5,6,0.99)),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:auto,42px_42px,42px_42px]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="dashboard-card mb-6 rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#8ee8d0]">
                Centrum dowodzenia
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
                Dzien dobry! Dzis: {formatDate(now)}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#aab7b2]">
                Live panel dla pogody, kursow NBP, swiat i najwazniejszych
                narzedzi agenta.
              </p>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3dd6a3]/50 bg-[#0d211b] px-4 py-3 text-sm font-semibold text-[#c7fff0] transition hover:border-[#7af0cb] hover:bg-[#12362b]"
            >
              <span className="font-mono text-xs">REFRESH</span>
              Odswiez dane
            </button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Pogoda"
            icon="WX"
            gradient="from-[#0a2147]/80 to-[#073344]/80"
            delay={80}
            updatedAt={weather.data?.updatedAt}
            isLoading={weather.isLoading}
            error={weather.error}
          >
            {weather.data && (
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-lg font-medium text-white">{weather.data.city}</p>
                    <p className="mt-2 text-6xl font-semibold text-white">
                      {weather.data.temperature}C
                    </p>
                  </div>
                  <p className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/85">
                    {weatherLabel(weather.data.weatherCode)}
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-white/50">Wiatr</p>
                    <p className="mt-1 font-semibold">{weather.data.windSpeed} km/h</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-white/50">Wilgotnosc</p>
                    <p className="mt-1 font-semibold">{weather.data.humidity}%</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Kursy walut"
            icon="FX"
            gradient="from-[#082819]/85 to-[#064434]/80"
            delay={160}
            updatedAt={rates.data?.[0]?.updatedAt}
            isLoading={rates.isLoading}
            error={rates.error}
          >
            <div className="space-y-3">
              {rates.data?.map((rate) => {
                const isUp = (rate.delta ?? 0) >= 0;
                return (
                  <div
                    key={rate.code}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.06] p-4"
                  >
                    <div>
                      <p className="text-sm text-white/55">{rate.code}</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {rate.rate.toFixed(4)} PLN
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-sm font-semibold ${
                        isUp ? "bg-emerald-300/15 text-emerald-100" : "bg-red-300/15 text-red-100"
                      }`}
                    >
                      {rate.delta === null ? "0.0000" : `${isUp ? "+" : ""}${rate.delta.toFixed(4)}`}
                    </span>
                  </div>
                );
              })}
              {oldestRateDate && (
                <p className="text-xs text-white/50">Kurs z: {oldestRateDate} (NBP)</p>
              )}
            </div>
          </Card>

          <Card
            title="Nadchodzace swieta"
            icon="CAL"
            gradient="from-[#3b1906]/85 to-[#4b3006]/80"
            delay={240}
            updatedAt={holidays.data ? new Date() : undefined}
            isLoading={holidays.isLoading}
            error={holidays.error}
          >
            <div className="space-y-3">
              {holidays.data?.map((holiday) => (
                <div
                  key={holiday.date}
                  className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.06] p-3"
                >
                  <div className="w-16 shrink-0 rounded-md border border-white/10 bg-white/10 px-2 py-2 text-center text-sm font-semibold">
                    {formatHolidayDate(holiday.date)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{holiday.localName}</p>
                    <p className="text-xs text-white/45">{daysUntil(holiday.date)} dni</p>
                  </div>
                </div>
              ))}
              {nextHoliday && (
                <p className="pt-1 text-sm font-semibold text-amber-100">
                  Nastepne za: {daysUntil(nextHoliday.date)} dni
                </p>
              )}
            </div>
          </Card>

          <Card
            title="Szybkie akcje"
            icon="GO"
            gradient="from-[#241247]/85 to-[#4b123f]/80"
            delay={320}
            updatedAt={now}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex min-h-14 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.12]"
                >
                  <span className="grid h-8 w-11 shrink-0 place-items-center rounded-md border border-white/10 bg-black/15 font-mono text-[10px]">
                    {action.icon}
                  </span>
                  <span className="min-w-0">{action.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
