"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { useImageAttachment } from "../lib/image-attachments";

type FacebookPosts = {
  short: string; medium: string; long: string; hashtags: string[];
  graphicCta: string; engagementQuestion: string; sharePrompt: string; pinnedComment: string;
};

type ProductResult = {
  productName: string; shortDescription: string; fullDescription: string;
  materials: string[]; dimensions: string; productionMethod: string; leadTime: string;
  categories: string[]; tags: string[]; safetyInfo: string; seoTitle: string;
  metaDescription: string; focusKeyphrase: string; facebookPost: string;
  facebookPosts?: FacebookPosts; uncertainties: string[];
};

const demoBase = {
  leadTime: "3–7 dni roboczych",
  safetyInfo: "<p><strong>GPSR:</strong> Produkt dekoracyjny, nie zabawka. Zawiera małe elementy. Chroń przed wilgocią, ogniem i przechowuj poza zasięgiem dzieci poniżej 3 lat.</p>",
};

const braceletFacebook: FacebookPosts = {
  short: "Niektóre drobiazgi mówią więcej niż długie życzenia. ✨ Ręcznie tworzona bransoletka z kamieni naturalnych może przypominać bliskiej osobie o ważnej chwili każdego dnia. Dopasujemy rozmiar, by dobrze leżała i cieszyła przez lata. Napisz wiadomość i opowiedz, dla kogo ma powstać.",
  medium: "Prezent nie musi być duży, żeby nieść ważne znaczenie. Czasem wystarczy subtelny detal, który każdego dnia przypomina o osobie, od której go otrzymaliśmy. ✨\n\nTa bransoletka powstaje ręcznie z kamieni naturalnych i starannie dobranych elementów jubilerskich. Każdy egzemplarz tworzony jest osobno, dlatego zachowuje własny charakter. Możliwość dopasowania obwodu sprawia, że biżuteria dobrze układa się na nadgarstku i staje się osobistym dodatkiem, a nie przypadkowym upominkiem.\n\nPodaruj ją komuś bliskiemu na urodziny, rocznicę albo bez okazji — wtedy, gdy chcesz powiedzieć „myślę o Tobie” bez wielu słów. Napisz w wiadomości prywatnej i ustalmy szczegóły Twojej wersji. 💌",
  long: "Są prezenty, które cieszą przez chwilę. Są też takie, które wracają we wspomnieniach za każdym razem, gdy zakładamy je na nadgarstek. ✨\n\nWyobraź sobie bliską osobę otwierającą niewielkie pudełko. W środku znajduje bransoletkę stworzoną specjalnie z myślą o niej — delikatną, osobistą i gotową towarzyszyć jej w zwyczajnych oraz ważnych dniach. To właśnie emocja stojąca za tym podarunkiem nadaje mu prawdziwą wartość.\n\nBransoletka powstaje ręcznie z kamieni naturalnych, elementów jubilerskich i elastycznej linki. Każdy kamień może nieznacznie różnić się od pozostałych, dzięki czemu gotowy egzemplarz zachowuje swój indywidualny charakter. Starannie wykończona kompozycja jest lekka i subtelna, a możliwość dopasowania obwodu pozwala przygotować biżuterię dla konkretnej osoby.\n\nDzięki temu nie wręczasz seryjnego dodatku, lecz pamiątkę z intencją. Może uczcić urodziny, rocznicę, ważną zmianę albo stać się czułym gestem bez okazji. Za każdym razem przypomni obdarowanej osobie, że ktoś poświęcił czas, by wybrać dla niej coś tworzonego z uważnością.\n\nJeśli chcesz zamówić własną wersję, napisz w wiadomości prywatnej i podaj potrzebny rozmiar. Razem dopracujemy szczegóły, zanim rozpocznę pracę. 💌",
  hashtags: ["#bransoletkahandmade", "#kamienienaturalne", "#biżuteriahandmade", "#rękodzieło", "#polskamarka", "#prezentdlakobiety", "#prezenturodzinowy", "#prezentodserca", "#biżuterianazamówienie", "#handmadewithlove", "#personalizowanyprezent", "#małabizuteria"],
  graphicCta: "✨ Stwórz swoją bransoletkę",
  engagementQuestion: "Komu podarowałabyś bransoletkę stworzoną specjalnie dla niej?",
  sharePrompt: "Udostępnij ten post komuś, kto właśnie szuka osobistego prezentu.",
  pinnedComment: "Które kamienie lub kolory najchętniej zobaczyłybyście w kolejnej wersji? Zostawcie pomysł w komentarzu 👇",
};

const weddingCardFacebook: FacebookPosts = {
  short: "Kiedy życzenia mają zostać z Parą Młodą na dłużej niż jeden wieczór, liczy się oprawa. 🤍 Ręcznie wykonana kartka ślubna 3D z imionami, datą i osobistą treścią staje się częścią rodzinnych wspomnień. Napisz do nas wcześniej i zarezerwuj termin wykonania.",
  medium: "Są słowa, których nie powinno się zamykać w przypadkowej oprawie. 🤍 W dniu ślubu życzenia stają się fragmentem wspólnej historii — warto więc podarować je w formie, do której Para Młoda wróci po latach.\n\nKartkę ślubną 3D wykonujemy ręcznie z ozdobnych papierów, tekturek i warstwowych dekoracji. Imiona, data uroczystości oraz treść wewnątrz pozwalają dopasować projekt do konkretnych osób. Dzięki temu prezent nie ginie wśród gotowych wzorów, lecz staje się osobistą pamiątką jednego z najważniejszych dni.\n\nJeśli znasz już datę uroczystości, nie odkładaj zamówienia na ostatnią chwilę. Napisz do nas, opowiedz o stylu wesela i zarezerwuj termin realizacji. ✨",
  long: "Najważniejsze życzenia zasługują na oprawę, która nie zniknie po zakończeniu wesela. 🤍\n\nWyobraź sobie spokojny wieczór już po uroczystości. Para Młoda wraca do otrzymanych pamiątek, czyta osobiste słowa i ponownie przeżywa emocje tego dnia. Ręcznie wykonana kartka może stać się jednym z tych drobiazgów, które trafiają do rodzinnego pudełka ze wspomnieniami i po latach nadal mają znaczenie.\n\nKartka ślubna 3D powstaje warstwa po warstwie z ozdobnego papieru, tekturek i starannie dobranych dekoracji. Przestrzenna kompozycja nadaje jej elegancki charakter, a personalizacja pozwala umieścić imiona Pary Młodej, datę ślubu oraz życzenia napisane właśnie dla nich. Każdy projekt składamy ręcznie, dlatego nie jest kopią produktu z masowej półki.\n\nDzięki temu wręczasz coś więcej niż dodatek do prezentu. Dajesz trwałe miejsce dla słów, które w dniu pełnym wzruszeń mogłyby umknąć. Kartka pasuje zarówno do klasycznej uroczystości, jak i kameralnego ślubu — jej ostateczny charakter możemy dopasować do stylu wydarzenia na podstawie przekazanych informacji.\n\nRęczna praca wymaga czasu, dlatego warto pomyśleć o zamówieniu wcześniej. Jeśli data ślubu jest już ustalona, napisz do nas i zarezerwuj termin. Opowiedz o Parze Młodej, a przygotujemy projekt z osobistym znaczeniem. ✨",
  hashtags: ["#kartkaślubna", "#ślub2026", "#prezentślubny", "#pamiątkaślubna", "#kartkahandmade", "#scrapbooking", "#ręcznierobione", "#personalizacja", "#paramłoda", "#wesele", "#polskierękodzieło", "#prezentnazamówienie", "#ślubneinspiracje"],
  graphicCta: "🤍 Zarezerwuj termin",
  engagementQuestion: "Jakie słowa chcielibyście zachować na pamiątkę dnia ślubu?",
  sharePrompt: "Udostępnij post osobie, która wkrótce wybiera się na ślub.",
  pinnedComment: "Klasyczna biel, pastele czy mocniejszy kolor przewodni — którą oprawę wybralibyście dla Pary Młodej?",
};

const explodingBoxFacebook: FacebookPosts = {
  short: "Najpierw zwykłe pudełko. Chwilę później — ściany rozkładają się i odsłaniają urodzinową historię. 🎉 Exploding box z imieniem, wiekiem i osobistymi życzeniami zamienia wręczenie prezentu w mały spektakl. Sprawdź dostępność terminu i zamów projekt dla bliskiej osoby.",
  medium: "To wygląda jak niewielkie pudełko… aż do chwili, gdy zdejmujesz wieczko. 🎉 Ścianki rozkładają się jedna po drugiej, odsłaniając dekoracje, imię, ważną liczbę i życzenia przygotowane dla jednej konkretnej osoby.\n\nUrodzinowy exploding box tworzymy ręcznie z papieru, tektury, wstążek i dopasowanych ozdób. Każda warstwa buduje moment zaskoczenia, a personalizacja sprawia, że w środku może znaleźć się historia, której nie da się kupić w gotowym zestawie. Dzięki temu wręczenie prezentu samo staje się wspomnieniem — pełnym ciekawości, śmiechu i wzruszenia.\n\nMasz w kalendarzu ważne urodziny? Napisz, dla kogo ma powstać pudełko, i sprawdź dostępny termin realizacji. 🎁",
  long: "Nie zdradza od razu, co skrywa. Stoi zamknięte, niewielkie i niepozorne — aż ktoś unosi wieczko, a kolejne ścianki rozkładają się, odsłaniając przygotowaną specjalnie dla niego opowieść. 🎉\n\nWłaśnie ten moment zaskoczenia sprawia, że exploding box nie jest tylko opakowaniem. To część urodzinowego przeżycia: najpierw ciekawość, potem uśmiech, a na końcu osobiste życzenia i detale, które pokazują, jak dobrze znasz obdarowaną osobę.\n\nKażde pudełko wykonujemy ręcznie z papieru, tektury, wstążek i elementów dekoracyjnych. Konstrukcja jest starannie bigowana i składana, a wnętrze może zostać dopasowane poprzez imię, wiek, kolorystykę oraz treść życzeń. Warstwowe dekoracje prowadzą wzrok przez kolejne części projektu, dzięki czemu odkrywanie zawartości staje się małym spektaklem.\n\nTaka forma pozwala przekazać coś, czego nie daje seryjna kartka. Dzięki personalizacji prezent opowiada o konkretnej osobie, a po urodzinach może zostać pamiątką przechowującą zdjęcia, słowa i wspomnienie wspólnie spędzonego dnia. Każdy projekt powstaje pojedynczo, dlatego jego finalne materiały i ozdoby dobieramy do ustalonego motywu.\n\nJeżeli zbliżają się ważne urodziny, sprawdź dostępność, zanim kalendarz realizacji się wypełni. Napisz, dla kogo ma powstać exploding box, podaj okazję i opowiedz o motywie, który najlepiej pasuje do tej osoby. 🎁",
  hashtags: ["#explodingbox", "#boxurodzinowy", "#urodziny", "#prezenturodzinowy", "#niespodzianka", "#personalizowanyprezent", "#scrapbookingpolska", "#papierowecuda", "#rękodzieło", "#handmadepolska", "#prezentodserca", "#pomysłnaprezent", "#tworzonezamówienie"],
  graphicCta: "🎁 Odkryj niespodziankę",
  engagementQuestion: "Czyj uśmiech chcielibyście zobaczyć przy otwieraniu takiego pudełka?",
  sharePrompt: "Podeślij ten pomysł osobie, która planuje urodzinową niespodziankę.",
  pinnedComment: "Co powinno znaleźć się w środku Waszego wymarzonego boxa: zdjęcia, życzenia czy ukryta kieszonka? 👇",
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
    facebookPost: braceletFacebook.medium, facebookPosts: braceletFacebook,
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
    facebookPost: weddingCardFacebook.medium, facebookPosts: weddingCardFacebook,
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
    facebookPost: explodingBoxFacebook.medium, facebookPosts: explodingBoxFacebook,
    uncertainties: ["Finalne materiały zależą od projektu"],
  }},
];

function Copy({ value, label = "Kopiuj HTML" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={async () => {
    await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500);
  }} className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]">
    {done ? "Skopiowano ✓" : label}
  </button>;
}

function completeFacebookPost(post: string, content: FacebookPosts) {
  return [post, content.engagementQuestion, content.sharePrompt, content.hashtags.join(" ")].join("\n\n");
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

  return <main onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
    {isDraggingImage && <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--overlay)] text-2xl text-[var(--overlay-text)] backdrop-blur-sm">Upuść zdjęcie produktu</div>}
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[.28em] text-[var(--accent)]">Fikartki · studio opisów</p>
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_.7fr]">
          <div><h1 className="max-w-3xl font-serif text-4xl leading-[1.08] sm:text-6xl">Zamień zdjęcie w opis, który sprzedaje.</h1>
          <p className="mt-5 max-w-2xl leading-7 text-[var(--text-secondary)]">Dwa opisy SEO, komplet postów na Facebook, kategorie, tagi i bezpieczeństwo — gotowe do publikacji.</p></div>
          <div className="flex flex-wrap gap-2 lg:justify-end">{["Vision", "Google Search", "readWebPage", "calculator", "Wikipedia"].map(x => <span key={x} className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">{x}</span>)}</div>
        </div>
      </div>
    </header>

    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[.78fr_1.22fr]">
      <section className="space-y-5">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Krok 1</p>
          <h2 className="mt-1 font-serif text-2xl">Wstaw zdjęcie produktu</h2>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileInputChange} className="hidden" />
          {attachedImage ? <div className="relative mt-4 overflow-hidden rounded-2xl bg-[var(--card-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachedImage.dataUrl} alt="Wybrany produkt" className="aspect-[4/3] w-full object-contain" />
            <button type="button" onClick={clearImage} className="absolute right-3 top-3 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow">Zmień</button>
          </div> : <button type="button" onClick={openFilePicker} className="mt-4 grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-7 text-center hover:bg-[var(--surface-hover)]">
            <span><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-soft)] text-2xl">↥</span><strong className="mt-4 block font-serif text-xl">Wstaw zdjęcie produktu</strong><span className="mt-2 block text-sm text-[var(--muted)]">PNG, JPG lub WEBP · maks. 4 MB</span></span>
          </button>}
          {imageError && <p className="mt-3 text-sm text-[var(--danger)]">{imageError}</p>}
          <label className="mt-5 block text-sm font-semibold" htmlFor="notes">Co warto wiedzieć? <span className="font-normal text-[var(--muted)]">(opcjonalnie)</span></label>
          <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Np. 14 × 14 cm, papier 250 g, realizacja 5 dni…" className="mt-2 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--input-placeholder)] focus:border-[var(--focus-ring)]" />
          <button type="button" onClick={generate} disabled={!attachedImage || loading} className="mt-4 w-full rounded-full bg-[var(--accent)] px-5 py-3.5 text-sm font-bold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Tworzę opis i posty…" : "Wygeneruj opis produktu →"}
          </button>
          {error && <p className="mt-3 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
        </div>
        <div><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Wypróbuj przykład</p>
          <div className="grid gap-2">{examples.map(ex => <button key={ex.title} type="button" onClick={() => setResult(ex.data)} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-left hover:border-[var(--border-strong)]">
            <span className="h-12 w-12 rounded-xl" style={{ background: `linear-gradient(135deg, ${ex.color}, var(--card-muted))` }} /><span className="flex-1"><strong className="block font-serif">{ex.title}</strong><span className="text-xs text-[var(--muted)]">{ex.subtitle}</span></span><span>→</span>
          </button>)}</div>
        </div>
      </section>

      <section className="min-w-0">
        {!result && !loading && <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-8 text-center"><div><span className="text-5xl">❧</span><h2 className="mt-4 font-serif text-3xl">Tu pojawi się gotowy opis</h2><p className="mt-3 text-sm text-[var(--muted)]">Dodaj zdjęcie lub wybierz jeden z przykładów.</p></div></div>}
        {loading && <div className="min-h-[560px] rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-7"><div className="h-7 w-2/3 animate-pulse rounded bg-[var(--card-muted)]" />{[1,2,3,4].map(n => <div key={n} className="mt-8 h-16 animate-pulse rounded bg-[var(--card-muted)]" />)}</div>}
        {result && !loading && <div className="space-y-5">
          <article className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow-card)] sm:p-8">
            <div className="flex flex-wrap justify-between gap-4 border-b border-[var(--border)] pb-5"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Gotowe do WooCommerce</p><h2 className="mt-2 font-serif text-3xl">{result.productName}</h2></div><Copy value={`${result.shortDescription}\n${result.fullDescription}\n${result.safetyInfo}`} label="Kopiuj całość" /></div>
            <div className="mt-6"><div className="mb-3 flex justify-between gap-3"><h3 className="font-serif text-xl">Krótki opis</h3><Copy value={result.shortDescription} /></div><div className="woocommerce-preview text-sm leading-7 text-[var(--text-secondary)]" dangerouslySetInnerHTML={{__html: result.shortDescription}} /></div>
            <div className="mt-7 border-t border-[var(--border)] pt-6"><div className="mb-3 flex justify-between gap-3"><h3 className="font-serif text-xl">Pełny opis</h3><Copy value={result.fullDescription} /></div><div className="woocommerce-preview text-sm leading-7 text-[var(--text-secondary)]" dangerouslySetInnerHTML={{__html: result.fullDescription}} /></div>
          </article>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Dane produktu"><p><b>Materiały:</b> {result.materials.join(", ")}</p><p><b>Wielkość:</b> {result.dimensions}</p><p><b>Wykonanie:</b> {result.productionMethod}</p><p><b>Realizacja:</b> {result.leadTime}</p></Card>
            <Card title="Organizacja sklepu"><Chips label="Kategorie" items={result.categories} /><Chips label="Tagi" items={result.tags.map(x => `#${x}`)} /></Card>
          </div>
          <div className="rounded-3xl border border-[var(--warning)] bg-[var(--warning-soft)] p-5"><div className="flex justify-between gap-3"><h3 className="font-serif text-xl">Bezpieczeństwo · GPSR</h3><Copy value={result.safetyInfo} /></div><div className="woocommerce-preview mt-3 text-sm leading-7" dangerouslySetInnerHTML={{__html: result.safetyInfo}} /></div>
          <Card title="SEO"><p><b>Tytuł:</b> {result.seoTitle}</p><p><b>Fraza:</b> {result.focusKeyphrase}</p><p><b>Meta opis:</b> {result.metaDescription}</p></Card>
          {result.facebookPosts ? <FacebookContent content={result.facebookPosts} /> : <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-serif text-xl">Propozycja posta na Facebook</h3><Copy value={result.facebookPost} label="Kopiuj post" /></div>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">{result.facebookPost}</p>
          </div>}
          {result.uncertainties.length > 0 && <p className="rounded-2xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-xs"><b>Sprawdź przed publikacją:</b> {result.uncertainties.join(" · ")}</p>}
        </div>}
      </section>
    </div>
  </main>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm leading-6"><h3 className="mb-3 font-serif text-xl">{title}</h3>{children}</div>;
}

function FacebookContent({ content }: { content: FacebookPosts }) {
  const variants = [
    { label: "Post krótki", hint: "około 400 znaków", value: content.short },
    { label: "Post średni", hint: "około 900 znaków", value: content.medium },
    { label: "Post długi", hint: "1200–1800 znaków", value: content.long },
  ];

  return <section className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)] sm:p-7">
    <div className="border-b border-[var(--border)] pb-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--accent)]">Social media</p>
      <h3 className="mt-2 font-serif text-2xl">Posty na Facebook</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">Trzy gotowe warianty — każdy z pytaniem, zachętą do udostępnienia i hashtagami.</p>
    </div>

    <div className="mt-5 space-y-4">
      {variants.map(variant => <article key={variant.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h4 className="font-serif text-lg">{variant.label}</h4><p className="text-xs text-[var(--muted)]">{variant.hint}</p></div>
          <Copy value={completeFacebookPost(variant.value, content)} label="Kopiuj post" />
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--text-secondary)]">{variant.value}</p>
        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4 text-sm leading-6">
          <p><strong>Pytanie:</strong> {content.engagementQuestion}</p>
          <p><strong>Udostępnienie:</strong> {content.sharePrompt}</p>
        </div>
      </article>)}
    </div>

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-serif text-lg">Hashtagi</h4><Copy value={content.hashtags.join(" ")} label="Kopiuj" /></div>
        <div className="mt-3 flex flex-wrap gap-2">{content.hashtags.map(tag => <span key={tag} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs">{tag}</span>)}</div>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-serif text-lg">CTA do grafiki</h4><Copy value={content.graphicCta} label="Kopiuj" /></div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{content.graphicCta}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-serif text-lg">Komentarz przypięty</h4><Copy value={content.pinnedComment} label="Kopiuj" /></div>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{content.pinnedComment}</p>
        </div>
      </div>
    </div>
  </section>;
}

function Chips({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-3"><p className="text-xs text-[var(--muted)]">{label}</p><div className="mt-2 flex flex-wrap gap-2">{items.map(x => <span key={x} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs">{x}</span>)}</div></div>;
}
