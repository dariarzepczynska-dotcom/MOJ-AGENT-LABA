"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useImageAttachment } from "../lib/image-attachments";

type ProductResult = {
  productName: string; shortDescription: string; fullDescription: string;
  materials: string[]; dimensions: string; productionMethod: string; leadTime: string;
  categories: string[]; tags: string[]; safetyInfo: string; seoTitle: string;
  metaDescription: string; focusKeyphrase: string; uncertainties: string[];
};

const demoBase = {
  leadTime: "3–7 dni roboczych",
  safetyInfo: "<p><strong>GPSR:</strong> Produkt dekoracyjny, nie zabawka. Zawiera małe elementy. Chroń przed wilgocią, ogniem i przechowuj poza zasięgiem dzieci poniżej 3 lat.</p>",
};

const examples: Array<{ title: string; subtitle: string; color: string; data: ProductResult }> = [
  { title: "Bransoletka z kamieni", subtitle: "Biżuteria · prezent handmade", color: "#a88461", data: {
    ...demoBase, productName: "Subtelna bransoletka z kamieni naturalnych",
    shortDescription: "<p>Delikatna <strong>bransoletka handmade</strong> z kamieni naturalnych, tworzona ręcznie z dbałością o każdy detal.</p>",
    fullDescription: "<h2>Bransoletka tworzona z uważnością</h2><p>Naturalne piękno kamieni spotyka się tu z ręcznym wykonaniem. Każdy egzemplarz powstaje pojedynczo i może być dopasowany do obdarowanej osoby.</p><h3>Najważniejsze cechy</h3><ul><li>ręczne wykonanie,</li><li>naturalne materiały,</li><li>możliwość personalizacji rozmiaru.</li></ul><p><strong>Czas realizacji:</strong> 3–7 dni roboczych.</p>",
    materials: ["kamienie naturalne", "elementy jubilerskie", "linka elastyczna"], dimensions: "Obwód do uzupełnienia",
    productionMethod: "Ręczne nawlekanie i wykończenie", categories: ["Biżuteria"],
    tags: ["bransoletka", "kamienie naturalne", "handmade", "prezent"],
    seoTitle: "Bransoletka z kamieni naturalnych handmade", focusKeyphrase: "bransoletka z kamieni naturalnych",
    metaDescription: "Subtelna bransoletka z kamieni naturalnych, tworzona ręcznie na zamówienie. Wyjątkowy dodatek i piękny pomysł na prezent.",
    uncertainties: ["Dokładny rodzaj kamieni", "Obwód bransoletki"],
  }},
  { title: "Kartka ślubna 3D", subtitle: "Kartki · Ślub", color: "#9e6f76", data: {
    ...demoBase, productName: "Ręcznie robiona kartka ślubna 3D",
    shortDescription: "<p>Elegancka <strong>kartka ślubna handmade</strong> z warstwowymi dekoracjami, tworzona na zamówienie i gotowa do personalizacji.</p>",
    fullDescription: "<h2>Wyjątkowa kartka ślubna handmade</h2><p>Pamiątka stworzona z myślą o jednym z najważniejszych dni. Warstwowa kompozycja nadaje jej elegancki, przestrzenny charakter.</p><h3>Personalizacja</h3><ul><li>imiona Pary Młodej,</li><li>data uroczystości,</li><li>życzenia wewnątrz kartki.</li></ul><p><strong>Czas realizacji:</strong> 3–7 dni roboczych.</p>",
    materials: ["papier ozdobny", "tekturka", "elementy dekoracyjne"], dimensions: "Do uzupełnienia",
    productionMethod: "Scrapbooking i ręczne warstwowanie", categories: ["Kartki", "Ślub"],
    tags: ["kartka ślubna", "handmade", "personalizacja", "ślub"],
    seoTitle: "Kartka ślubna handmade 3D z personalizacją", focusKeyphrase: "kartka ślubna handmade",
    metaDescription: "Ręcznie robiona kartka ślubna 3D z personalizacją imion, daty i życzeń. Elegancka pamiątka tworzona na zamówienie.",
    uncertainties: ["Wymiary kartki", "Dokładne materiały dekoracji"],
  }},
  { title: "Exploding box", subtitle: "Kartki · Urodziny", color: "#71846f", data: {
    ...demoBase, productName: "Urodzinowy exploding box na zamówienie",
    shortDescription: "<p>Efektowny <strong>exploding box urodzinowy</strong> wykonany ręcznie i dopasowany do osoby obdarowanej.</p>",
    fullDescription: "<h2>Exploding box pełen niespodzianek</h2><p>Po zdjęciu wieczka ścianki rozkładają się, odsłaniając dekoracyjne wnętrze. Projekt może otrzymać imię, wiek i osobiste życzenia.</p><h3>Wykonanie</h3><ul><li>ręczne składanie,</li><li>warstwowe dekoracje,</li><li>personalizacja na zamówienie.</li></ul><p><strong>Czas realizacji:</strong> 3–7 dni roboczych.</p>",
    materials: ["papier", "tektura", "wstążki", "ozdoby"], dimensions: "około 10 × 10 × 10 cm",
    productionMethod: "Scrapbooking, bigowanie i ręczne zdobienie", categories: ["Kartki", "Exploding Box", "Kartki urodzinowe"],
    tags: ["exploding box", "urodziny", "personalizowany prezent", "handmade"],
    seoTitle: "Exploding box urodzinowy na zamówienie", focusKeyphrase: "exploding box urodzinowy",
    metaDescription: "Personalizowany exploding box urodzinowy wykonany ręcznie. Imię, wiek, życzenia i kolorystyka dopasowane do wyjątkowej okazji.",
    uncertainties: ["Finalne materiały zależą od projektu"],
  }},
];

function Copy({ value, label = "Kopiuj HTML" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={async () => {
    await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500);
  }} className="rounded-full border border-[#cdbba9] bg-white px-4 py-2 text-xs font-semibold hover:border-[#846a54]">
    {done ? "Skopiowano ✓" : label}
  </button>;
}

export default function ProductDescriptionPage() {
  const {
    attachedImage, imageError, isDraggingImage, fileInputRef, openFilePicker,
    clearImage, handleFileInputChange, handleDragOver, handleDragLeave, handleDrop,
  } = useImageAttachment();
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ProductResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!attachedImage || loading) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await authFetch("/api/product-description", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: attachedImage.dataUrl, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się wygenerować opisu.");
      setResult(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się wygenerować opisu.");
    } finally { setLoading(false); }
  }

  return <main onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="min-h-screen bg-[#f8f4ee] text-[#342c27]">
    {isDraggingImage && <div className="fixed inset-0 z-50 grid place-items-center bg-[#342c27]/80 text-2xl text-white backdrop-blur-sm">Upuść zdjęcie produktu</div>}
    <header className="border-b border-[#ded2c5] bg-[#f3ece3] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.28em] text-[#9b765d]">Fikartki · studio opisów</p>
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_.7fr]">
          <div><h1 className="max-w-3xl font-serif text-4xl leading-[1.08] sm:text-6xl">Zamień zdjęcie w opis, który sprzedaje.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[#71645b]">Dwa opisy SEO, kategorie, tagi i bezpieczeństwo — gotowe do WooCommerce.</p></div>
          <div className="flex flex-wrap gap-2 lg:justify-end">{["Vision", "Google Search", "readWebPage", "calculator", "Wikipedia"].map(x => <span key={x} className="rounded-full border border-[#d6c7b8] bg-white/70 px-3 py-1.5 text-xs text-[#725f51]">{x}</span>)}</div>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[.78fr_1.22fr]">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-[#ded2c5] bg-white p-5 shadow-[0_18px_50px_rgba(71,51,37,.07)]">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#a17a60]">Krok 1</p>
          <h2 className="mt-1 font-serif text-2xl">Wstaw zdjęcie produktu</h2>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileInputChange} className="hidden" />
          {attachedImage ? <div className="relative mt-4 overflow-hidden rounded-2xl bg-[#eee7de]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachedImage.dataUrl} alt="Wybrany produkt" className="aspect-[4/3] w-full object-contain" />
            <button type="button" onClick={clearImage} className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold shadow">Zmień</button>
          </div> : <button type="button" onClick={openFilePicker} className="mt-4 grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-[#bea890] bg-[#faf7f2] p-7 text-center hover:bg-[#f7efe6]">
            <span><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e8ddd1] text-2xl">↥</span><strong className="mt-4 block font-serif text-xl">Wstaw zdjęcie produktu</strong><span className="mt-2 block text-sm text-[#89796e]">PNG, JPG lub WEBP · maks. 4 MB</span></span>
          </button>}
          {imageError && <p className="mt-3 text-sm text-[#a34747]">{imageError}</p>}
          <label className="mt-5 block text-sm font-semibold" htmlFor="notes">Co warto wiedzieć? <span className="font-normal text-[#9a8c82]">(opcjonalnie)</span></label>
          <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Np. 14 × 14 cm, papier 250 g, realizacja 5 dni…" className="mt-2 w-full resize-none rounded-2xl border border-[#ded2c5] bg-[#fdfbf8] px-4 py-3 text-sm outline-none focus:border-[#95745c]" />
          <button type="button" onClick={generate} disabled={!attachedImage || loading} className="mt-4 w-full rounded-full bg-[#4a3a30] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#2f241e] disabled:opacity-40">
            {loading ? "Tworzę opis i sprawdzam sklep…" : "Wygeneruj opis produktu →"}
          </button>
          {error && <p className="mt-3 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#9d3f38]">{error}</p>}
        </div>
        <div><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#a17a60]">Wypróbuj przykład</p>
          <div className="grid gap-2">{examples.map(ex => <button key={ex.title} type="button" onClick={() => setResult(ex.data)} className="flex items-center gap-3 rounded-2xl border border-[#ded2c5] bg-white p-3 text-left hover:border-[#b79f89]">
            <span className="h-12 w-12 rounded-xl" style={{ background: `linear-gradient(135deg, ${ex.color}, #eadfd4)` }} /><span className="flex-1"><strong className="block font-serif">{ex.title}</strong><span className="text-xs text-[#8f8075]">{ex.subtitle}</span></span><span>→</span>
          </button>)}</div>
        </div>
      </section>

      <section className="min-w-0">
        {!result && !loading && <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-[#ded2c5] bg-[#f1e9df]/60 p-8 text-center"><div><span className="text-5xl">❧</span><h2 className="mt-4 font-serif text-3xl">Tu pojawi się gotowy opis</h2><p className="mt-3 text-sm text-[#88786d]">Dodaj zdjęcie lub wybierz jeden z przykładów.</p></div></div>}
        {loading && <div className="min-h-[560px] rounded-[28px] border border-[#ded2c5] bg-white p-7"><div className="h-7 w-2/3 animate-pulse rounded bg-[#e8ded4]" />{[1,2,3,4].map(n => <div key={n} className="mt-8 h-16 animate-pulse rounded bg-[#f1ebe5]" />)}</div>}
        {result && !loading && <div className="space-y-5">
          <article className="rounded-[28px] border border-[#ded2c5] bg-white p-6 shadow-[0_18px_50px_rgba(71,51,37,.07)] sm:p-8">
            <div className="flex flex-wrap justify-between gap-4 border-b border-[#eadfd5] pb-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#a17a60]">Gotowe do WooCommerce</p><h2 className="mt-2 font-serif text-3xl">{result.productName}</h2></div><Copy value={`${result.shortDescription}\n${result.fullDescription}\n${result.safetyInfo}`} label="Kopiuj całość" /></div>
            <div className="mt-6"><div className="mb-3 flex justify-between gap-3"><h3 className="font-serif text-xl">Krótki opis</h3><Copy value={result.shortDescription} /></div><div className="woocommerce-preview text-sm leading-7 text-[#584b43]" dangerouslySetInnerHTML={{__html: result.shortDescription}} /></div>
            <div className="mt-7 border-t border-[#eadfd5] pt-6"><div className="mb-3 flex justify-between gap-3"><h3 className="font-serif text-xl">Pełny opis</h3><Copy value={result.fullDescription} /></div><div className="woocommerce-preview text-sm leading-7 text-[#584b43]" dangerouslySetInnerHTML={{__html: result.fullDescription}} /></div>
          </article>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Dane produktu"><p><b>Materiały:</b> {result.materials.join(", ")}</p><p><b>Wielkość:</b> {result.dimensions}</p><p><b>Wykonanie:</b> {result.productionMethod}</p><p><b>Realizacja:</b> {result.leadTime}</p></Card>
            <Card title="Organizacja sklepu"><Chips label="Kategorie" items={result.categories} /><Chips label="Tagi" items={result.tags.map(x => `#${x}`)} /></Card>
          </div>
          <div className="rounded-3xl border border-[#d9c4a7] bg-[#fffaf1] p-5"><div className="flex justify-between gap-3"><h3 className="font-serif text-xl">Bezpieczeństwo · GPSR</h3><Copy value={result.safetyInfo} /></div><div className="woocommerce-preview mt-3 text-sm leading-7" dangerouslySetInnerHTML={{__html: result.safetyInfo}} /></div>
          <Card title="SEO"><p><b>Tytuł:</b> {result.seoTitle}</p><p><b>Fraza:</b> {result.focusKeyphrase}</p><p><b>Meta opis:</b> {result.metaDescription}</p></Card>
          {result.uncertainties.length > 0 && <p className="rounded-2xl border border-[#dfc9a6] bg-[#fff8e9] px-4 py-3 text-xs"><b>Sprawdź przed publikacją:</b> {result.uncertainties.join(" · ")}</p>}
        </div>}
      </section>
    </div>
  </main>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2 rounded-3xl border border-[#ded2c5] bg-white p-5 text-sm leading-6"><h3 className="mb-3 font-serif text-xl">{title}</h3>{children}</div>;
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-3"><p className="text-xs text-[#9a877a]">{label}</p><div className="mt-2 flex flex-wrap gap-2">{items.map(x => <span key={x} className="rounded-full bg-[#eee5dc] px-3 py-1 text-xs">{x}</span>)}</div></div>;
}
