# Odbiór UI/UX — stan lokalny

Stan z 13 listopada 2026, frontend `e881b3cadbd3c9973829d1939a69c6fa9ec1647c`, Node 26.10.0, pnpm 12.14.0. To zapis wykonanych prób, nie akceptacja całego planu ani potwierdzenie wdrożenia.

## Automatyzacja lokalna

- `CI=1 pnpm exec playwright test --workers=3`: 89 testów przeszło, 25 pominięto. Projekty: Chromium, Firefox i mobilny Chromium. Aplikacja i większość usług korzystały z lokalnych atrap; konfiguracja pomija osobny plik `quotes-layout.spec.ts`.
- `pnpm test:e2e:quotes-layout`: 5 testów przeszło; atrapa RPC, szerokości 320, 390, 1280 i 1440 px. Próba obejmuje edycję ośmiu pozycji, zapis, przełączanie widoku, prawą kolumnę długiego podglądu A4 i panel transferu.
- `pnpm test`: 240 testów przeszło; `pnpm check`, `pnpm lint`, `pnpm build` i `pnpm proto:check` przeszły przy poprzedniej kontroli kodu. W testach pojawia się ostrzeżenie Svelte `derived_inert`, a w teście przeglądarkowym również ostrzeżenie o przestarzałej opcji `goto`.
- Snapshot proto frontendu odpowiadał zdalnemu `main` UniSourceCFL `96fcc4a` poprzez lokalny checkout referencyjny. Wskazany w planie checkout `/Users/daniel/Projects/UniSourceCFL` był starszy i porównanie z nim wykazało różnice w trzech plikach. Nie sprawdzono na tej podstawie wersji produkcji.

### Powody pominięć Playwright

- `multipart-live.spec.ts`: dwa scenariusze w trzech projektach wymagają osobno uruchomionej izolowanej usługi i `E2E_LIVE_MULTIPART=1` — 6 pominięć.
- `quotes-live.spec.ts` i `quotes-integrated.spec.ts`: po jednym scenariuszu w trzech projektach wymagającym osobnego środowiska i konfiguracji — 6 pominięć.
- Trzy scenariusze dużego pliku w `multipart.spec.ts` uruchamiane są tylko w Chromium — 6 pominięć.
- Gest dotykowy w `catalog-selection.spec.ts` uruchamiany jest tylko w projekcie mobilnym — 2 pominięcia.
- `move-entry.spec.ts`: przenoszenie pominięto w Firefox, a przeciąganie uruchamiane jest tylko w desktopowym Chromium — 3 pominięcia.
- Test schowka w `share-links.spec.ts` uruchamiany jest tylko w Chromium — 2 pominięcia.

## Nierozstrzygnięty odbiór

- Brak pełnego porównania podglądu z rzeczywistym wielostronicowym PDF, w tym marginesów, podziałów, stopek i kwot. Lokalny podgląd to ciągły HTML, a nie paginowany PDF.
- Brak aktualnego dowodu pełnego przepływu wycen z izolowanym UniSourceGO oraz prób transferów na rzeczywistych R2 i RustFS. Wyniki z atrap nie dowodzą zachowania tych usług.
- Samsung SM-S931B był widoczny przez ADB, ale w chwili sporządzania raportu nie wykonano na nim próby interfejsu. Brak także próby na iPhonie/Safari. Emulacja nie zastępuje klawiatury ekranowej, obrotu, safe-area, pobierania i mediów na urządzeniach.
- Nie zakończono pełnego przeglądu obu motywów, wszystkich rozmiarów z macierzy, powiększenia tekstu, reduced-motion i pomiarów kontrastu. Screenshoty nie stanowią zatwierdzonych wizualnie wzorców.
- Nie wykonano wdrożenia ani produkcyjnego smoke testu dla tego zestawu zmian; nie potwierdzono wersji produkcyjnej ani ścieżki rollbacku dla wydania.
