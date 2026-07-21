"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

type SavedDocument = {
  title: string;
  chunks: number;
  created_at: string | null;
};

type StreamEvent = {
  type?: "progress" | "complete" | "error";
  current?: number;
  total?: number;
  chunks_saved?: number;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Brak daty";

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Operacja nie powiodła się.";
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingTitle, setDeletingTitle] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await authFetch("/api/upload-knowledge", { cache: "no-store" });

      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as { documents?: SavedDocument[] };
      setDocuments(data.documents ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nie udało się pobrać dokumentów.");
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  const refreshDocuments = () => {
    setIsLoadingDocuments(true);
    void loadDocuments();
  };

  useEffect(() => {
    // Initial synchronization with the external document store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !content.trim() || isUploading) return;

    setIsUploading(true);
    setProgress({ current: 0, total: 0 });
    setMessage(null);
    setError(null);

    try {
      const response = await authFetch("/api/upload-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      });

      if (!response.ok) throw new Error(await readError(response));
      if (!response.body) throw new Error("Serwer nie zwrócił strumienia postępu.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let saved = 0;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const update = JSON.parse(line) as StreamEvent;

          if (update.type === "progress") {
            setProgress({ current: update.current ?? 0, total: update.total ?? 0 });
          } else if (update.type === "complete") {
            saved = update.chunks_saved ?? 0;
          } else if (update.type === "error") {
            throw new Error(update.error ?? "Nie udało się zapisać dokumentu.");
          }
        }

        if (done) break;
      }

      setMessage(`✅ Zapisano ${saved} fragmentów!`);
      setTitle("");
      setContent("");
      await loadDocuments();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nie udało się zapisać dokumentu.");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (documentTitle: string) => {
    if (deletingTitle || !window.confirm(`Usunąć dokument „${documentTitle}” wraz ze wszystkimi fragmentami?`)) return;

    setDeletingTitle(documentTitle);
    setError(null);

    try {
      const response = await authFetch("/api/upload-knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: documentTitle }),
      });

      if (!response.ok) throw new Error(await readError(response));
      setDocuments((current) => current.filter((document) => document.title !== documentTitle));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nie udało się usunąć dokumentu.");
    } finally {
      setDeletingTitle(null);
    }
  };

  const percentage = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#050807] px-4 py-8 text-[#edf7f3] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#3dd6a3]">RAG / Supabase</p>
          <h1 className="text-3xl font-bold sm:text-4xl">📚 Baza wiedzy</h1>
          <p className="mt-3 text-[#9fb3ab]">Wklej tekst — agent będzie z niego korzystał</p>
        </header>

        <form onSubmit={onSubmit} className="rounded-2xl border border-[#263b34] bg-[#09110f] p-5 shadow-2xl shadow-black/20 sm:p-7">
          <label className="block text-sm font-semibold" htmlFor="document-title">Tytuł dokumentu</label>
          <input
            id="document-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
            disabled={isUploading}
            className="mt-2 w-full rounded-xl border border-[#2f403b] bg-[#050a09] px-4 py-3 outline-none transition placeholder:text-[#61736c] focus:border-[#3dd6a3] disabled:opacity-60"
          />

          <label className="mt-6 block text-sm font-semibold" htmlFor="document-content">Treść dokumentu</label>
          <textarea
            id="document-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Wklej tutaj treść dokumentu..."
            disabled={isUploading}
            className="mt-2 min-h-[300px] w-full resize-y rounded-xl border border-[#2f403b] bg-[#050a09] px-4 py-3 leading-7 outline-none transition placeholder:text-[#61736c] focus:border-[#3dd6a3] disabled:opacity-60"
          />

          <div className="mt-3 text-xs leading-5 text-[#81958d]">
            Podpowiedzi: cennik pakietów, pytania i odpowiedzi FAQ albo treść regulaminu.
          </div>

          {isUploading && (
            <div className="mt-5" aria-live="polite">
              <div className="mb-2 flex justify-between text-sm text-[#b8ccc4]">
                <span>Przetwarzam fragment {progress.current} z {progress.total || "…"}...</span>
                <span>{percentage}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#17241f]">
                <div className="h-full rounded-full bg-[#3dd6a3] transition-all" style={{ width: `${percentage}%` }} />
              </div>
            </div>
          )}

          {message && <p className="mt-5 rounded-xl border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-emerald-200">{message}</p>}
          {error && <p className="mt-5 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={isUploading || !title.trim() || !content.trim()}
            className="mt-6 rounded-xl bg-[#3dd6a3] px-5 py-3 font-bold text-[#04110d] transition hover:bg-[#75e5bd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? "Przetwarzam…" : "📤 Zapisz w bazie wiedzy"}
          </button>
        </form>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Zapisane dokumenty</h2>
            <button type="button" onClick={refreshDocuments} disabled={isLoadingDocuments} className="text-sm text-[#3dd6a3] disabled:opacity-50">Odśwież</button>
          </div>

          {isLoadingDocuments ? (
            <p className="text-[#8da198]">Wczytuję dokumenty…</p>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#30463e] p-8 text-center text-[#849a91]">Baza wiedzy jest jeszcze pusta.</div>
          ) : (
            <div className="grid gap-3">
              {documents.map((document) => (
                <article key={document.title} className="flex flex-col gap-4 rounded-xl border border-[#263b34] bg-[#09110f] p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{document.title}</h3>
                    <p className="mt-1 text-sm text-[#8fa39b]">{document.chunks} fragmentów · {formatDate(document.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteDocument(document.title)}
                    disabled={deletingTitle !== null}
                    className="self-start rounded-lg border border-red-900/70 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/40 disabled:opacity-50 sm:self-auto"
                  >
                    {deletingTitle === document.title ? "Usuwam…" : "🗑️ Usuń"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
