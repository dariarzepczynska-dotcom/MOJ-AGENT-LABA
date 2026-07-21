"use client";

import { authFetch } from "@/lib/auth-fetch";

import { FormEvent, useCallback, useEffect, useState } from "react";

type DocumentSummary = {
  title: string;
  chunks: number;
  created_at: string | null;
};

type DocumentChunk = {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type SearchResult = {
  title: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  added_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Brak daty";

  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error ?? "Operacja nie powiodła się.";
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
        const response = await authFetch("/api/knowledge", { cache: "no-store" });
      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as {
        documents?: DocumentSummary[];
        total_chunks?: number;
      };
      setDocuments(data.documents ?? []);
      setTotalChunks(data.total_chunks ?? 0);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać bazy wiedzy.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial synchronization with the external document store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDocuments();
  }, [loadDocuments]);

  const selectDocument = async (title: string) => {
    if (selectedTitle === title) {
      setSelectedTitle(null);
      setChunks([]);
      return;
    }

    setSelectedTitle(title);
    setIsLoadingChunks(true);
    setError(null);

    try {
        const response = await authFetch(
        `/api/knowledge?title=${encodeURIComponent(title)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as { chunks?: DocumentChunk[] };
      setChunks(data.chunks ?? []);
    } catch (loadError) {
      setChunks([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nie udało się pobrać fragmentów.",
      );
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    setError(null);

    try {
        const response = await authFetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as { results?: SearchResult[] };
      setResults(data.results ?? []);
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Nie udało się przeszukać bazy.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050807] px-4 py-8 text-[#edf7f3] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#3dd6a3]">
            RAG / diagnostyka
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Twoja baza wiedzy</h1>
          <p className="mt-3 text-[#9fb3ab]">
            {totalChunks} fragmentów z {documents.length} dokumentów
          </p>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-red-200">
            {error}
          </p>
        )}

        <section className="rounded-2xl border border-[#263b34] bg-[#09110f] p-5 sm:p-7">
          <h2 className="text-xl font-bold">Test wyszukiwania semantycznego</h2>
          <p className="mt-2 text-sm text-[#8fa39b]">
            Wyniki używają tego samego embeddingu i progu 0,5 co agent.
          </p>
          <form onSubmit={search} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj w bazie wiedzy..."
              className="min-w-0 flex-1 rounded-xl border border-[#2f403b] bg-[#050a09] px-4 py-3 outline-none placeholder:text-[#61736c] focus:border-[#3dd6a3]"
            />
            <button
              type="submit"
              disabled={!query.trim() || isSearching}
              className="rounded-xl bg-[#3dd6a3] px-5 py-3 font-bold text-[#04110d] disabled:opacity-50"
            >
              {isSearching ? "Szukam…" : "Szukaj"}
            </button>
          </form>

          {hasSearched && !isSearching && (
            <div className="mt-6 space-y-3">
              {results.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#425149] p-5 text-[#9fb3ab]">
                  Brak fragmentów z podobieństwem co najmniej 0,5.
                </div>
              ) : (
                results.map((result, index) => (
                  <article
                    key={`${result.title}-${index}`}
                    className="rounded-xl border border-[#2d4940] bg-[#07100e] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">{result.title}</h3>
                      <span className="rounded-full bg-[#17352d] px-2.5 py-1 font-mono text-xs text-[#9fe8cf]">
                        similarity: {result.similarity.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#c4d2cd]">
                      {result.content}
                    </p>
                    <p className="mt-3 text-xs text-[#788d85]">
                      Dodano: {formatDate(result.added_at)} · fragment {String(result.metadata.chunk_index ?? "?")}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Dokumenty</h2>
            <button
              type="button"
              onClick={() => void loadDocuments()}
              className="text-sm text-[#3dd6a3]"
            >
              Odśwież
            </button>
          </div>

          {isLoading ? (
            <p className="text-[#8da198]">Wczytuję dokumenty…</p>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#30463e] p-8 text-center text-[#849a91]">
              Baza wiedzy jest pusta. Dodaj dokument na stronie /upload.
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <article
                  key={document.title}
                  className="rounded-xl border border-[#263b34] bg-[#09110f]"
                >
                  <button
                    type="button"
                    onClick={() => void selectDocument(document.title)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  >
                    <span>
                      <span className="block font-semibold text-white">{document.title}</span>
                      <span className="mt-1 block text-sm text-[#8fa39b]">
                        {document.chunks} fragmentów · {formatDate(document.created_at)}
                      </span>
                    </span>
                    <span className="text-[#3dd6a3]">
                      {selectedTitle === document.title ? "Ukryj" : "Podejrzyj"}
                    </span>
                  </button>

                  {selectedTitle === document.title && (
                    <div className="space-y-3 border-t border-[#263b34] p-5">
                      {isLoadingChunks ? (
                        <p className="text-[#8da198]">Wczytuję fragmenty…</p>
                      ) : (
                        chunks.map((chunk, index) => (
                          <div
                            key={chunk.id}
                            className="rounded-lg border border-[#2d4940] bg-[#050a09] p-4"
                          >
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6fcfad]">
                              Fragment {index + 1}
                            </p>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-[#c4d2cd]">
                              {chunk.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
