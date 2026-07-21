"use client";

import { FormEvent, useState } from "react";

const examplePrompts = [
  "Minimalistyczne logo kawiarni w stylu japonskim",
  "Post na Instagram: kawa latte art, cieple swiatlo, widok z gory",
  "Kreacja reklamowa: wyprzedaz letnia -50%, nowoczesny design",
  "Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design",
  "Infografika: 5 krokow do produktywnosci, pastelowe kolory",
  "Zdjecie produktowe: elegancki zegarek na ciemnym tle",
];

type GeneratedImage = {
  image: string;
  text: string;
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const generateImage = async (promptToGenerate: string) => {
    const trimmedPrompt = promptToGenerate.trim();

    if (!trimmedPrompt || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setLastPrompt(trimmedPrompt);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udalo sie wygenerowac obrazu.");
      }

      setResult({
        image: data.image,
        text: data.text ?? "",
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udalo sie wygenerowac obrazu.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    generateImage(prompt);
  };

  const downloadImage = () => {
    if (!result?.image) {
      return;
    }

    const link = document.createElement("a");
    link.href = result.image;
    link.download = "ai-generated.png";
    link.click();
  };

  return (
    <main className="min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 font-[system-ui]">
        <header className="border-b border-[#24312d] pb-6">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            🎨 Generator grafik AI
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#a7b8b0] sm:text-base">
            Opisz co chcesz - AI stworzy obraz w kilka sekund
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={onSubmit}
            className="rounded-lg border border-[#24312d] bg-[#070b0a]/90 p-4 shadow-2xl shadow-black/20 sm:p-5"
          >
            <label
              htmlFor="image-prompt"
              className="text-sm font-semibold text-[#dce7e2]"
            >
              Prompt
            </label>
            <textarea
              id="image-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Opisz obraz ktory chcesz wygenerowac..."
              disabled={isLoading}
              rows={7}
              className="mt-2 w-full resize-none rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm leading-6 text-[#ededed] outline-none transition placeholder:text-[#6b7d76] focus:border-[#3dd6a3] disabled:opacity-70"
            />

            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="mt-4 w-full rounded-lg bg-[#3dd6a3] px-5 py-3 font-semibold text-[#04110d] transition hover:bg-[#75e5bd] disabled:cursor-not-allowed disabled:opacity-50"
            >
              🎨 Generuj
            </button>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-[#dce7e2]">
                Przyklady
              </p>
              <div className="grid gap-2">
                {examplePrompts.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setPrompt(example)}
                    className="rounded-lg border border-[#2f403b] bg-[#091310]/85 px-3 py-2 text-left text-sm leading-5 text-[#d1d5db] transition hover:border-[#3dd6a3] hover:bg-[#0d1d18] hover:text-[#ededed]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <section className="min-h-[520px] rounded-lg border border-[#24312d] bg-[#070b0a]/90 p-4 shadow-2xl shadow-black/20 sm:p-5">
            {isLoading && (
              <div className="flex h-full min-h-[480px] animate-pulse items-center justify-center rounded-lg border border-dashed border-[#3dd6a355] bg-[#091310] text-sm font-medium text-[#9fe8cf]">
                Generuje... (5-15 sekund)
              </div>
            )}

            {!isLoading && !result && !error && (
              <div className="flex h-full min-h-[480px] items-center justify-center rounded-lg border border-dashed border-[#2f403b] bg-[#091310]/55 px-4 text-center text-sm leading-6 text-[#7f928b]">
                Wpisz opis grafiki albo wybierz przyklad.
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm leading-6 text-[#fecaca]">
                {error}
              </div>
            )}

            {!isLoading && result && (
              <div className="space-y-4">
                <img
                  src={result.image}
                  alt={lastPrompt}
                  className="w-full rounded-lg border border-[#2f403b] bg-[#091310] object-contain"
                />
                {result.text && (
                  <p className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm leading-6 text-[#cbd5d1]">
                    {result.text}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={downloadImage}
                    className="rounded-lg border border-[#3d514b] bg-[#0d1715] px-4 py-3 text-sm font-semibold text-[#ededed] transition hover:border-[#3dd6a3]"
                  >
                    💾 Pobierz
                  </button>
                  <button
                    type="button"
                    onClick={() => generateImage(lastPrompt)}
                    className="rounded-lg border border-[#3d514b] bg-[#0d1715] px-4 py-3 text-sm font-semibold text-[#ededed] transition hover:border-[#3dd6a3]"
                  >
                    🔄 Ponownie
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
