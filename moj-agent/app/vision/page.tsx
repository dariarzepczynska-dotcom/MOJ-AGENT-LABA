"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ImageAttachmentPreview } from "../components/ImageAttachmentPreview";
import { useImageAttachment } from "../lib/image-attachments";

const quickQuestions = [
  "Co widzisz na tym obrazie?",
  "Wyciagnij caly tekst z tego screena",
  "Opisz to w 3 zdaniach",
  "Jakie kolory dominuja? Podaj kody HEX",
  "Wygeneruj podobny obraz w innym stylu",
];

async function readTextStream(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export default function VisionPage() {
  const {
    attachedImage,
    imageError,
    isDraggingImage,
    fileInputRef,
    attachFile,
    clearImage,
    openFilePicker,
    handlePaste,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useImageAttachment();
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const [question, setQuestion] = useState("Co widzisz na tym obrazie?");
  const [answer, setAnswer] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    dropZoneRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((clipboardItem) =>
        clipboardItem.type.startsWith("image/"),
      );
      const file = item?.getAsFile();

      if (!file) {
        return;
      }

      event.preventDefault();
      void attachFile(file);
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [attachFile]);

  const analyzeImage = async (prompt: string) => {
    if (!attachedImage || isAnalyzing || isGenerating) {
      return "";
    }

    setIsAnalyzing(true);
    setError("");
    setAnswer("");
    setGeneratedImage("");
    setGeneratedPrompt("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "casual",
          model: "flash",
          image: attachedImage.dataUrl,
          messages: [
            {
              id: `vision-${messageIdRef.current++}`,
              role: "user",
              parts: [{ type: "text", text: prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const text = await readTextStream(response);
      setAnswer(text);
      return text;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udalo sie przeanalizowac obrazu.";
      setError(message);
      return "";
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateSimilarImage = async () => {
    const description = await analyzeImage(
      "Opisz ten obraz jako szczegolowy prompt do generatora obrazu. Zachowaj kompozycje i najwazniejsze elementy, ale zaproponuj inny styl wizualny. Zwroc tylko finalny prompt.",
    );

    if (!description) {
      return;
    }

    setIsGenerating(true);
    setError("");
    setGeneratedPrompt(description);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: description }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Nie udalo sie wygenerowac obrazu.");
      }

      setGeneratedImage(data.image);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nie udalo sie wygenerowac obrazu.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const submitQuestion = (prompt: string) => {
    if (prompt === "Wygeneruj podobny obraz w innym stylu") {
      void generateSimilarImage();
      return;
    }

    setQuestion(prompt);
    void analyzeImage(prompt);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void analyzeImage(question.trim() || "Co widzisz na tym obrazie?");
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-screen bg-[#050506] px-4 py-6 text-[#ededed] sm:px-6"
    >
      {isDraggingImage && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-2xl font-semibold text-[#9fe8cf] backdrop-blur-sm">
          Upusc obraz
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-6 font-[system-ui]">
        <header className="border-b border-[#24312d] pb-6">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            👁️ Agent Vision
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#a7b8b0] sm:text-base">
            Wklej screenshot, wrzuc plik lub przeciagnij obraz
          </p>
        </header>

        {!attachedImage && (
          <div
            ref={dropZoneRef}
            tabIndex={0}
            role="button"
            onClick={openFilePicker}
            onPaste={handlePaste}
            className="flex min-h-[420px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[#3dd6a355] bg-[#07100e] px-6 text-center outline-none transition hover:border-[#3dd6a3] focus:border-[#3dd6a3]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <p className="text-2xl font-semibold text-[#dce7e2]">
              📸 Ctrl+V - wklej screenshot
            </p>
            <p className="text-xl font-semibold text-[#dce7e2]">
              📁 Kliknij - wybierz plik
            </p>
            <p className="text-xl font-semibold text-[#dce7e2]">
              🖱️ Przeciagnij - upusc obraz
            </p>
          </div>
        )}

        {imageError && (
          <p className="rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm text-[#fecaca]">
            {imageError}
          </p>
        )}

        {attachedImage && (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <ImageAttachmentPreview
                image={attachedImage}
                onRemove={clearImage}
              />
              <form onSubmit={onSubmit} className="space-y-3">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onPaste={handlePaste}
                  rows={4}
                  disabled={isAnalyzing || isGenerating}
                  className="w-full resize-none rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm leading-6 text-[#ededed] outline-none transition placeholder:text-[#6b7d76] focus:border-[#3dd6a3]"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || isGenerating}
                  className="w-full rounded-lg bg-[#3dd6a3] px-5 py-3 font-semibold text-[#04110d] transition hover:bg-[#75e5bd] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Analizuj
                </button>
              </form>
              <div className="grid gap-2">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submitQuestion(item)}
                    disabled={isAnalyzing || isGenerating}
                    className="rounded-lg border border-[#2f403b] bg-[#091310]/85 px-3 py-2 text-left text-sm leading-5 text-[#d1d5db] transition hover:border-[#3dd6a3] hover:bg-[#0d1d18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {(isAnalyzing || isGenerating) && (
                <div className="rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm text-[#9fe8cf]">
                  {isGenerating ? "Generuje nowa wersje..." : "Analizuje obraz..."}
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-[#7f1d1d] bg-[#2a0d0d] px-4 py-3 text-sm leading-6 text-[#fecaca]">
                  {error}
                </div>
              )}
              {answer && (
                <div className="whitespace-pre-wrap rounded-lg border border-[#2f403b] bg-[#091310] px-4 py-3 text-sm leading-6 text-[#dce7e2]">
                  {answer}
                </div>
              )}
              {generatedImage && (
                <div className="grid gap-4 md:grid-cols-2">
                  <img
                    src={attachedImage.dataUrl}
                    alt="Oryginal"
                    className="w-full rounded-lg border border-[#2f403b] bg-[#091310] object-contain"
                  />
                  <img
                    src={generatedImage}
                    alt={generatedPrompt}
                    className="w-full rounded-lg border border-[#2f403b] bg-[#091310] object-contain"
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
