"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/lib/supabase";
import {
  BriefingRow,
  formatBriefingDate,
  getBriefingPreview,
} from "./briefing-utils";

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<BriefingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [error, setError] = useState("");

  const loadBriefings = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("briefings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (queryError) {
      console.error("Nie udało się pobrać briefingów:", queryError);
      setError("Nie udało się pobrać briefingów.");
    } else {
      setBriefings((data ?? []) as BriefingRow[]);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBriefings();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBriefings]);

  const generateBriefing = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const response = await authFetch("/api/cron/morning");
      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Nie udało się wygenerować briefingu.");
      }

      await loadBriefings();
    } catch (generationError) {
      console.error("Nie udało się wygenerować briefingu:", generationError);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Nie udało się wygenerować briefingu.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const generateButton = (
    <button
      type="button"
      onClick={() => void generateBriefing()}
      disabled={isGenerating}
      className="inline-flex items-center justify-center rounded-lg bg-[#3dd6a3] px-5 py-3 text-sm font-semibold text-[#04110d] transition hover:bg-[#75e5bd] disabled:cursor-wait disabled:opacity-60"
    >
      {isGenerating ? "Generowanie…" : "🔄 Wygeneruj teraz"}
    </button>
  );

  const deleteBriefing = async (briefing: BriefingRow) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten briefing?")) return;

    setDeletingId(briefing.id);
    setError("");

    try {
      const response = await authFetch(`/api/briefings/${briefing.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Nie udało się usunąć briefingu.");
      }

      setBriefings((current) =>
        current.filter((item) => item.id !== briefing.id),
      );
    } catch (deleteError) {
      console.error("Nie udało się usunąć briefingu:", deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Nie udało się usunąć briefingu.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <header className="border-b border-[#2a332f] bg-[#07100e]/80 px-4 py-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold sm:text-4xl">📰 Briefingi</h1>
              <p className="mt-3 text-[#a7b8b0]">
                Automatyczne podsumowania dnia od Twojego agenta
              </p>
            </div>
            {generateButton}
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm text-[#fecaca]">
            {error}
          </div>
        )}

        <section className="mt-5 space-y-3">
          {isLoading && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-8 text-center text-[#cfe7df]">
              Wczytywanie briefingów…
            </div>
          )}

          {!isLoading && briefings.length === 0 && (
            <div className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-10 text-center">
              <p className="mb-5 text-lg font-semibold">
                Brak briefingów. Cron job wygeneruje pierwszy jutro rano!
              </p>
              {generateButton}
            </div>
          )}

          {briefings.map((briefing) => (
            <article
              key={briefing.id}
              className="group flex flex-col gap-4 rounded-xl border border-[#2f403b] bg-[#091310] p-5 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-[#3dd6a3] hover:bg-[#0d1715] sm:flex-row sm:items-start"
            >
              <Link
                href={`/briefings/${briefing.id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold capitalize text-white">
                    {formatBriefingDate(briefing)}
                  </h2>
                  <p className="mt-3 line-clamp-2 leading-6 text-[#b6c4be]">
                    {getBriefingPreview(briefing.content) || "Briefing bez treści"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#3dd6a350] bg-[#0d211b] px-3 py-1.5 text-xs font-semibold text-[#c7fff0]">
                  ✅ wygenerowany automatycznie
                </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => void deleteBriefing(briefing)}
                disabled={deletingId === briefing.id}
                aria-label={`Usuń briefing z dnia ${formatBriefingDate(briefing)}`}
                title="Usuń briefing"
                className="grid h-10 w-10 shrink-0 place-items-center self-end rounded-lg border border-red-900/70 bg-red-950/30 text-lg text-red-300 transition hover:border-red-500 hover:bg-red-950/60 disabled:cursor-wait disabled:opacity-50 sm:self-start"
              >
                {deletingId === briefing.id ? "…" : "🗑️"}
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
