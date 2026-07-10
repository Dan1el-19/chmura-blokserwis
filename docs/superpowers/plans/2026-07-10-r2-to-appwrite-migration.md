# Plan: Administracyjna migracja R2 → Appwrite

**Status:** wdrożony live; panel administratora, logi i ręczne uruchamianie działają, a pełny test pliku 1.525 GB zakończył się sukcesem
**Cel:** panel administracyjny pozwala uruchomić, obserwować i kontrolować bezpieczną migrację plików z R2 do Appwrite. Upload nowych plików pozostaje szybki, a przenoszenie istniejących plików wykonuje nocny proces w `usrc-imap`.

## Ustalone decyzje

- Źródłem prawdy o lokalizacji pliku pozostaje UniSource/D1. Frontend nigdy nie wybiera źródła przy pobieraniu pliku ani nie dostaje kluczy R2/Appwrite.
- Do migracji kwalifikują się pliki `r2` o rozmiarze `> 0` i `<= 5 GiB`, od największych. Pliki większe dostają czytelny status `skipped_size_limit` i pozostają w R2.
- Automatyka startuje po przekroczeniu `2 GiB` w R2 i planuje największe pliki do osiągnięcia celu `1,5 GiB`. Dokładnie `2 GiB` nie uruchamia przebiegu; start następuje od pierwszego bajtu powyżej progu.
- Do progu kosztowego wliczają się aktywne pliki, pliki w koszu i ukończone artefakty releases z tego samego bucketa; każda kategoria jest liczona dokładnie raz.
- Panel administracyjny nie uruchamia transferu bezpośrednio. Tworzy run w UniSource, a Heroku odbiera go bezpiecznym kanałem wewnętrznym.
- Po powodzeniu następuje atomowe przełączenie rekordu `files` na `appwrite`; usunięcie obiektu z R2 jest późniejszym, powtarzalnym krokiem. Nigdy odwrotnie.

## Stan wdrożenia i test live — 2026-07-10

- Widok `/admin/storage-migrations` jest wdrożony i pokazuje wykorzystanie R2/Appwrite, próg startu `> 2 GiB`, cel `1,5 GiB`, aktywny przebieg, historię i trwałe zdarzenia zapisane przez UniSource w D1.
- Ręczny dry-run i ręczne utworzenie kolejki działają z panelu. UniSource po utworzeniu rzeczywistego runu budzi runner Heroku przez Cloudflare Access; nocny cron `0 2 * * *` w `Europe/Warsaw` pozostaje ścieżką automatyczną i awaryjną.
- Test live przeniósł plik `1 525 195 767 B` (`1.525 GB`). Pierwsza próba ujawniła OOM w ścieżce `FormData`/`Blob`; po wdrożeniu strumieniowego uploadu transfer wznowił się od trwałego checkpointu `508 559 360 B` i zakończył bez błędów Heroku R14/R15.
- Po teście rozmiar obiektu w Appwrite wynosił `1 525 195 767 B`, rekord pliku został przełączony na `appwrite`, a źródłowy obiekt R2 został usunięty. Wynik i kolejne etapy są widoczne w logach panelu.

## Granice odpowiedzialności

| Repozytorium                    | Odpowiedzialność                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `A:\Projects\chmura-blokserwis` | UI administratora, autoryzowane proxy do UniSource, prezentacja statusów i logów                                       |
| `A:\Projects\UniSource`         | D1, kolejka/dzierżawy, wybór kandydatów, API administratora i wewnętrzne API runnera, atomowe przełączenie lokalizacji |
| `A:\Projects\usrc-imap`         | nocny, wznawialny transfer R2 → Appwrite, checkpointy oraz sprzątanie R2                                               |

## File map

| Plik                                                    | Zmiana                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/routes/admin/settings/+page.server.ts`             | Zachować istniejącą konfigurację miejsca nowych uploadów i dodać link/entry point do migracji.            |
| `src/routes/admin/storage-migrations/+page.server.ts`   | Nowe ładowanie danych z administracyjnego API UniSource.                                                  |
| `src/routes/admin/storage-migrations/+page.svelte`      | Nowy widok: wykorzystanie, progi, uruchomienie ręczne, aktualny run, historia i błędy.                    |
| `src/routes/api/admin/storage-migrations/**/+server.ts` | Serwerowe proxy dla akcji administratora; walidacja wejścia i brak ekspozycji sekretów.                   |
| istniejąca nawigacja administratora                     | Dodać pozycję „Migracje storage”. Dokładny komponent ustalić przez graf zależności podczas implementacji. |
| `src/lib/modules/upload.svelte.ts`                      | Test regresji: wybór miejsca dla nowych uploadów pozostaje niezależny od migracji plików historycznych.   |

## Zadanie 1: Kontrakt panelu z UniSource

- [x] Dodać wyłącznie serwerową komunikację z endpointami UniSource używanymi przez bieżący panel:
  - `GET /v2/admin/storage-migrations/overview`
  - `POST /v2/admin/storage-migrations/runs` (ręczne uruchomienie lub dry-run)
- [x] Przekazywać administratorowi tylko dane operacyjne: liczby plików/bajtów, stany, opis błędu, momenty prób i identyfikatory runów. Nie zwracać `storage_key`, endpointów R2 ani danych uwierzytelniających.
- [x] Traktować stan API jako autorytatywny; nie obliczać użycia R2 po stronie Svelte.
- [ ] Rozszerzyć panel o anulowanie oczekującego runu i edycję ustawień dopiero wtedy, gdy te operacje będą wymagane operacyjnie.

## Zadanie 2: Widok administratora

- [x] Stworzyć `/admin/storage-migrations` z trzema sekcjami:
  1. **Stan storage** — użycie R2 i Appwrite, progi start/stop, liczba plików ponad 5 GiB.
  2. **Sterowanie** — ręczny dry-run i start runu; progi oraz scheduler pozostają konfiguracją serwerową, a nie ustawieniem przeglądarki.
  3. **Dziennik** — aktywny run, ostatnie zakończone runy i pozycje zakończone błędem ze stanem retry.
- [x] Pokazać stan aktywnego runu, postęp, wynik i dziennik zdarzeń, w tym błędy oraz retry sprzątania źródła.
- [x] Domyślnie transferować jeden plik na wywołanie runnera; dry-run nie tworzy aktywnej kolejki.
- [x] Oddzielić migrację plików historycznych od ustawienia miejsca docelowego _nowych uploadów_.

## Zadanie 3: Bezpieczeństwo i UX błędów

- [x] Wymagać istniejącej sesji administratora dla każdego load/action.
- [x] Mapować błędy UniSource i ostrzeżenie o nieudanym natychmiastowym obudzeniu runnera na komunikaty użytkowe; pełny szczegół techniczny pozostaje w logu runu.
- [x] Zablokować wielokrotne wysłanie tego samego formularza podczas oczekiwania na odpowiedź.
- [x] Nie wyświetlać akcji „usuń z R2” — to wyłącznie automatyczny etap po potwierdzonym przełączeniu metadanych.

## Zadanie 4: Testy i odbiór

- [x] Testy server action dla braku sesji, mapowania odpowiedzi UniSource i propagacji ostrzeżenia runnera.
- [x] `pnpm check`, właściwe testy Vitest, build i autofixer Svelte po zmianach panelu.
- [x] Smoke test: ręczny dry-run widoczny w panelu.
- [x] Test E2E live pliku `1 525 195 767 B`: wznowienie od checkpointu, pełny upload, przełączenie rekordu i usunięcie źródła R2.

## Kryteria akceptacji

- Administrator widzi, które pliki i ile bajtów zostało przeniesionych, pominiętych i odłożonych do retry.
- Zmiana lokalizacji w D1 natychmiast kieruje istniejące downloady/preview na Appwrite bez zmiany publicznego identyfikatora pliku.
- Panel nie posiada bezpośrednich poświadczeń do R2 ani Appwrite.
- Awaria runnera nie powoduje w UI fałszywego sukcesu ani zniknięcia pliku z R2.
