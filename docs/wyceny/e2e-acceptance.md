# Odbiór kreatora wycen — 16 listopada 2026

Zmiany są przygotowywane na `main` w Chmurze oraz UniSourceGO. Testy opisane poniżej nie są dowodem wdrożenia ani odbioru zalogowanej sesji na produkcji. Produkcyjne wyceny nie były czyszczone.

## Wynik końcowy

PASS: 16/16 Chromium/WebKit, 6/6 połączonych ścieżek desktop/mobile, 16/16 dokumentów PDF oraz cały `TestQuoteDraftTransactions` wraz z cutoverem (146,73 s). Frontend: 271 testów, check/lint/build i kontrakt Protobuf zielone. Backend: `go test ./...` i `go vet` zielone. Rzeczywisty research oraz konwerter PDF przeszły oddzielne testy.

## Automatyczne testy przeglądarkowe

```sh
pnpm exec playwright test --config=playwright.quotes-wizard.config.ts --workers=1
```

16 scenariuszy: Chromium i WebKit, PDF przy szerokościach 320/390/768/1024/1280/1440, odczyt tekstu z rzeczywistego PDF.js, blokada zatwierdzenia do renderowania aktualnego dokumentu, historia przeglądarki i zoom. Osobne ścieżki desktop/mobile obejmują propozycję agenta, prośbę o skrócenie, akceptację, edytor, powrót do PDF i zatwierdzenie. Te testy kontrolują transport API oraz sesję Clerk.

Nie uruchamiać równocześnie z buildem, kontrolą typów lub Vitest w tym samym checkout: narzędzia współdzielą wygenerowane pliki SvelteKit.

## Test połączony z backendem

W UniSourceGO:

```sh
QUOTES_TEST_DATABASE_URL='postgres://quotes@127.0.0.1:55433/unisource_quotes_test?sslmode=disable' \
QUOTES_TEST_RENDERER_URL=http://127.0.0.1:53000 \
QUOTES_TEST_CHMURA_DIR=/Users/daniel/Projects/chmura-blokserwis \
QUOTES_TEST_FIXTURES=internal/quotes/testdata/document-fixtures.json \
QUOTES_TEST_FIXTURE_OUTPUT=/tmp/quotes-wizard-pdfs \
go test ./internal/quotes -run '^TestQuoteDraftTransactions$' -count=1 -v
```

Wymaga pustej, jednorazowej lokalnej bazy `unisource_quotes_test` oraz Gotenberga pod wskazanym adresem. Test odmawia użycia innej nazwy bazy lub zdalnego hosta. Serwer HTTP, PostgreSQL, River, XLSX, wersjonowanie, publikacja i konwersja PDF są rzeczywiste. Magazyn obiektów i weryfikator sesji są izolowanymi implementacjami testowymi, a odpowiedzi modelu są kontrolowane. To nie jest odbiór Clerk/R2 na produkcji.

Test uruchamia sześć ścieżek: import z AI, import bez AI i ręczne wprowadzanie, każda na desktopie oraz mobile. W wariancie AI sprawdza również trwałą rozmowę po odświeżeniu i prośbę o poprawkę. Sprawdza odświeżenie, edycję, publikację, kolejną rewizję z tym samym numerem i pobranie prawdziwych plików PDF. Zestaw 16 fixture PDF obejmuje krótkie i długie dokumenty A4, długie nazwy, duże kwoty, wielostronicowe tabele oraz zakres. Sprawdzono zachowanie nazw, opisów i poprawne sumy w wygenerowanych plikach. Część Go obejmuje również konflikty wersji, trwałą rozmowę/propozycje/źródła, anulowanie, sekwencję zdarzeń, współbieżną numerację oraz cutover z ochroną innych modułów.

## Rzeczywisty research

`TestAgentPDFConverterAcceptance` sprawdza rzeczywisty konwerter Poppler po ustawieniu `QUOTES_TEST_PDF_FILE` na wygenerowany PDF. Nie wykonuje płatnych żądań.

`TestAgentLiveResearch` wymaga jawnego `QUOTES_TEST_LIVE_AGENT=1`, sekretów Brave/OpenAI w środowisku oraz `pdftotext` w PATH. Test jest domyślnie pomijany; wykonuje płatne żądania. Sekretów nie należy przekazywać w argumentach polecenia ani zapisywać w repozytorium.

Próba TP-Link TL-SG105 odczytała stronę producenta, wykonała Brave, otrzymała tekst w streamingu i zweryfikowaną propozycję ze źródłem. Ilość i cena pozostały bez zmian, zakres prac był pusty. Wcześniejsze próby Hikvision nie mogły odczytać treści strony; agent ograniczył opis do danych wejściowych, bez dopisywania specyfikacji podobnego wariantu.

## Pozostałe bramki

`pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`, `pnpm proto:check`, `pnpm exec node scripts/check-proto.mjs --quotes-backend /Users/daniel/Projects/UniSourceGO`, `go test ./...`, `go vet ./internal/quotes ./cmd/quotes-cutover`.

Wdrożenie API i workera, wdrożenie frontendu, produkcyjny odbiór Clerk/R2 oraz autoryzowany cutover są osobnymi etapami.
