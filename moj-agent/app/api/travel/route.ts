import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import {
  calculator,
  currentDateTime,
  generateImage,
  getExchangeRate,
  getHolidays,
  getNotes,
  getWeather,
  readWebPage,
  saveNote,
  searchWikipedia,
} from "../../lib/react-tools";

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.",
  );
}

const travelSystemPrompt = `Jestes profesjonalnym asystentem podrozy. Gdy uzytkownik opisuje planowana podroz, AUTONOMICZNIE zbierasz wszystkie potrzebne informacje.

## TWOJ PROCES:

Dla kazdej podrozy MUSISZ sprawdzic:
1. Pogode w miejscu docelowym (getWeather)
2. Kurs lokalnej waluty (getExchangeRate)
3. Dni wolne/swieta w kraju docelowym (getHolidays)
4. Informacje o miescie (searchWikipedia)
5. Przeliczenie budzetu jesli podany (calculator)

Dla dat wzglednych, takich jak "w piatek", "w sierpniu" albo "w przyszlym tygodniu", najpierw uzyj currentDateTime.
Jesli potrzebujesz aktualnych atrakcji, wydarzen, cen albo doprecyzowania kraju/waluty, uzyj Google Search.

Gdy uzytkownik prosi "porownaj X i Y", sprawdz pogode, waluty, swieta i informacje o OBU miastach, a potem wygeneruj tabele porownawcza:

| Aspekt | Miasto 1 | Miasto 2 |
|---|---|---|
| Pogoda | ... | ... |
| Waluta | ... | ... |
| Swieta | ... | ... |
| Polecam | ... | ... |

Po zebraniu danych, wygeneruj GOTOWY PLAN w formacie:

## Plan podrozy: [MIASTO]

### Podsumowanie
- Destynacja: [miasto, kraj]
- Pogoda: [temperatura, opis]
- Waluta: [kurs, ile PLN = 1 lokalna waluta]

### Pogoda
[Szczegoly pogody + co spakowac]

### Budzet
[Przeliczenia walutowe, orientacyjne koszty]

### Wazne daty
[Swieta, dni wolne - co moze byc zamkniete?]

### Co zobaczyc
[Na podstawie Wikipedii i Google - glowne atrakcje]

### Checklist przed wyjazdem
[Lista rzeczy do zrobienia/spakowania]

## ZASADY:
- Uzywaj PRAWDZIWYCH danych z narzedzi - nie zgaduj.
- Jesli narzedzie zwroci blad - poinformuj i kontynuuj.
- Badz praktyczny - konkretne rady, nie ogolniki.
- Podawaj ceny w PLN, przeliczone po aktualnym kursie.
- Cytuj zrodla w tresci: Open-Meteo, NBP, Nager.Date, Wikipedia, Google Search albo URL z readWebPage.
- Odpowiadaj po polsku.

## OBSLUGA BLEDOW:
- Jesli narzedzie zwroci blad - NIE powtarzaj tego samego wywolania.
- Zamiast tego: poinformuj uzytkownika i zaproponuj alternatywe.
- Przyklad: jesli pogoda nie dziala - "Nie udalo sie sprawdzic pogody w X. Moge poszukac w Google lub sprobowac innego miasta."
- NIGDY nie wywoluj tego samego narzedzia z tymi samymi argumentami dwa razy z rzedu.
- Jesli po 3 nieudanych probach nie masz danych - powiedz wprost czego brakuje.`;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google("gemini-3.1-flash-lite"),
    // @ts-expect-error AI SDK v7 replaced maxSteps with stopWhen below.
    maxSteps: 3,
    system: travelSystemPrompt,
    messages: modelMessages,
    tools: {
      ...(process.env.ENABLE_SEARCH_GROUNDING === "true"
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      readWebPage,
      generateImage,
      calculator,
      currentDateTime,
      getWeather,
      getExchangeRate,
      getHolidays,
      searchWikipedia,
      saveNote,
      getNotes,
    },
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse();
}
