"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  BriefingMarkdown,
  BriefingRow,
  formatBriefingDate,
} from "../briefing-utils";

export default function BriefingPage() {
  const params = useParams<{ id: string }>();
  const briefingId = useMemo(() => {
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);
  const [briefing, setBriefing] = useState<BriefingRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadBriefing = async () => {
      if (!briefingId) return;

      const { data, error: queryError } = await supabase
        .from("briefings")
        .select("*")
        .eq("id", briefingId)
        .maybeSingle();

      if (!mounted) return;

      if (queryError) {
        console.error("Nie udało się pobrać briefingu:", queryError);
        setError("Nie udało się pobrać briefingu.");
      } else if (!data) {
        setError("Nie znaleziono tego briefingu.");
      } else {
        setBriefing(data as BriefingRow);
      }

      setIsLoading(false);
    };

    void loadBriefing();
    return () => {
      mounted = false;
    };
  }, [briefingId]);

  const copyContent = async () => {
    if (!briefing?.content) return;

    try {
      await navigator.clipboard.writeText(briefing.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nie udało się skopiować treści.");
    }
  };

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex flex-col gap-4 border-b border-[#2a332f] bg-[#07100e]/80 px-4 py-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold capitalize text-[#9fe8cf]">
              {briefing ? formatBriefingDate(briefing) : "Briefing"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">📰 Poranny briefing</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/briefings"
              className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm font-semibold transition hover:border-[#3dd6a3]"
            >
              ← Wróć do listy
            </Link>
            <button
              type="button"
              onClick={() => void copyContent()}
              disabled={!briefing?.content}
              className="rounded-lg bg-[#3dd6a3] px-4 py-3 text-sm font-semibold text-[#04110d] transition hover:bg-[#75e5bd] disabled:opacity-50"
            >
              {copied ? "✅ Skopiowano" : "📋 Kopiuj"}
            </button>
          </div>
        </header>

        {isLoading && (
          <div className="mt-5 rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-8 text-center">
            Wczytywanie briefingu…
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-[#fecaca]">
            {error}
          </div>
        )}

        {briefing?.content && (
          <article className="mt-5 rounded-xl border border-[#2f403b] bg-[#091310] p-5 shadow-xl shadow-black/20 sm:p-8">
            <BriefingMarkdown content={briefing.content} />
          </article>
        )}
      </div>
    </main>
  );
}
