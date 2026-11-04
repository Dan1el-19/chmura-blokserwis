# Local and Remote Environment Cleanup Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkbox syntax for tracking. Execution authorized by the user on 2026-11-04. See the cleanup report for completed work and explicit remaining gates.

**Goal:** Jeden aktywny checkout i projekt Codex dla frontendu Chmura Blokserwis, zachowane niedokończone prace i historia, jedno działające źródło wdrożeń.

**Architecture:** Repo `Dan1el-19/chmura-blokserwis` i jego gałąź `main` są źródłem kodu produkcyjnego. GitHub Actions wykonuje CI, a Workers Builds wdraża istniejącego Workera `unisource-cloud`. Porządkowanie lokalnych katalogów i historycznych zasobów następuje dopiero po zachowaniu unikalnej pracy i sprawdzeniu zależności.

**Tech Stack:** Git, GitHub, Codex desktop, pnpm, SvelteKit, Wrangler, Cloudflare Workers Builds; `cf` do zasobów Builds.

**Spec:** Polecenie użytkownika z 2026-11-04: zaplanować uporządkowanie lokalnego i zdalnego środowiska po migracji repo, z zachowaniem historii `chmura-blokserwis`.

## Stan potwierdzony 2026-11-04

- Produkcja: `chmura.blokserwis.pl`, Worker `unisource-cloud`, repo `chmura-blokserwis/main`.
- Najnowszy sprawdzony commit docelowy: `cf030e7697877bf39dec930b3e5303d80ac00690`; CI i Workers Builds zakończone sukcesem.
- Źródłowe repo lokalne: `/Users/daniel/Projects/unisource-cloud`, czyste `main` na `af9e4e5`.
- Porównanie drzew Git: kod aplikacji w obu repo jest identyczny. Różnią się wyłącznie `README.md`, docelowy `AGENTS.md` i `docs/repository-migration.md`.
- Docelowy checkout: `/Users/daniel/Projects/chmura-blokserwis`, lokalny `main` na `44a5bcf`, trzy commity za znanym `origin/main`.
- Niedokończona praca: zmiana `src/routes/wyceny/nowa/+page.svelte`, nowy `src/routes/wyceny/nowa/page.svelte.spec.ts` i trzy pliki w `docs/audits/`.
- Worktree migracji: `/Users/daniel/.codex/worktrees/chmura-repo-migration`, czysty, gałąź `codex/replace-with-unisource-cloud`; jej commit jest już w `main`.
- `codex/opencloud-evaluation` zawiera unikalny commit `e5ae75b`; zachować jako historyczną pracę.
- Żadne z obu repo GitHub nie jest obecnie zarchiwizowane. Brak otwartych PR w obu repo.
- Stary Worker `chmura-blokserwis` nie ma wyzwalaczy Builds. Produkcyjny Worker ma jedno połączenie do nowego repo i wyłączone previews.
- W Codex są dwa lokalne projekty: `unisource-cloud` i `chmura-blokserwis`; obecny czat nadal korzysta z pierwszego.
- Katalogi zajmują orientacyjnie: źródło 821 MB, cel 620 MB, worktree migracji 816 MB. Rozmiary nie są gwarancją ilości miejsca do odzyskania.

## Ograniczenia

- Przed wykonaniem odświeżyć stan GitHub, referencje Git i konfigurację Cloudflare; wskazane SHA są punktem odniesienia, nie zgodą na nadpisanie późniejszych zmian.
- Zachować historię i tagi. Bez force push, `reset --hard`, `git clean` i usuwania niezabezpieczonych plików.
- Nazwa repo i wewnętrzna nazwa Workera mogą się różnić. Nie zmieniać nazwy produkcyjnego Workera tylko dla porządku.
- Wycen i dawnych propozycji OpenCloud nie przywracać do aktywnej aplikacji w ramach sprzątania.
- Zakres nie obejmuje backendu UniSourceCFL, danych R2/RustFS/D1, Clerk, tunelu, domen API i transferów ani nowych systemów kopii lub replikacji.
- Nigdy nie commitować sekretów ani kopiować całych katalogów z ignorowanymi plikami bez ich sprawdzenia.

## Review Focus

- Nieśledzone pliki wycen i audytów muszą znaleźć się w zachowanej historii przed aktualizacją checkoutu.
- Identyczna funkcja może mieć inne SHA w obu repo; zgodność oceniać po plikach, a nie nazwie commita.
- Gałąź `codex/opencloud-evaluation` nie jest scalona i nie kwalifikuje się do rutynowego usunięcia.
- Brak wyzwalacza Builds nie dowodzi, że stary Worker nie obsługuje domen, ruchu lub zależności.
- Projekt Codex, aktywne czaty, ignorowane konfiguracje i worktree nie mogą pozostać skierowane do usuniętej ścieżki.

## Zadanie 1: Zachować lokalną pracę i odświeżyć główny checkout

**Katalog:** `/Users/daniel/Projects/chmura-blokserwis`.

- [x] Wykonać `git fetch origin --prune`; ponownie sprawdzić `git status --short`, `git diff`, `git ls-files --others --exclude-standard`, `git worktree list` i listę gałęzi. Zbadać każdą dodatkową zmianę względem tego planu.
- [x] Utworzyć gałąź `codex/preserve-legacy-local-work-2026-11-04` od aktualnego lokalnego starego `main`. Zachować na niej zmianę strony wycen, jej nowy test oraz trzy audyty. Obejrzeć zawartość przed stagingiem i użyć jawnych ścieżek zamiast `git add -A`.
- [x] Sprawdzić `git show --stat` i treść zapisu; wypchnąć gałąź do `chmura-blokserwis`. Sprawdzić zgodność lokalnego i zdalnego SHA. Nie otwierać PR przywracającego starą aplikację i nie uruchamiać jej legacy workflowów.
- [x] Wrócić na `main`, wykonać `git merge --ff-only origin/main`. Ten plik planu zachować; jeśli koliduje z nowym plikiem zdalnym, porównać wersje i rozwiązać kolizję bez usuwania lokalnej treści.
- [x] Potwierdzić `git rev-parse HEAD origin/main`, zdalny adres `Dan1el-19/chmura-blokserwis` i obecność wcześniejszej historii przez `git merge-base --is-ancestor 44a5bcfaa1a160d66affe0208e75aa835fcdf317 HEAD`.

**Rezultat:** Aktualny główny checkout; niedokończona praca dostępna na zdalnej gałęzi historycznej. Pozostała lokalna zmiana to świadomie zachowany dokument planu, do włączenia z dokumentacją w zadaniu 3.

## Zadanie 2: Ustalić jeden lokalny projekt roboczy

- [x] Porównać nazwy i przeznaczenie ignorowanych `.env*`, `.dev.vars*`, lokalnych skryptów i konfiguracji w źródle, celu oraz worktree. Wyszukać unikalne pliki ignorowane poza `node_modules`, cache i artefaktami buildów. Same różnice śledzonych drzew nie obejmują tych plików.
- [x] Przenieść wyłącznie potrzebne ustawienia developerskie do docelowego checkoutu. Sprawdzić reguły `.gitignore` i korzystanie z developerskiego Clerk/API przed uruchomieniem lokalnym. Nie przenosić stanu `.wrangler` automatycznie.
- [x] W docelowym checkoutcie wykonać `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm lint`, `pnpm proto:check` i `pnpm build`. Uruchomić lokalnie frontend i potwierdzić właściwe środowisko. Jeśli zmiany ograniczą się do plików organizacyjnych, nie powtarzać całego E2E bez nowego powodu.
- [ ] Używać istniejącego lokalnego projektu Codex `chmura-blokserwis` o ścieżce `/Users/daniel/Projects/chmura-blokserwis`. Sprawdzić aktywne czaty i automatyzacje przed odpinaniem projektu `unisource-cloud`; historia czatów ma pozostać dostępna. Nie zakładać, że zmiana nazwy projektu przenosi katalog lub istniejący czat.
- [x] Sprawdzić uruchomione dev serwery i odnośniki narzędzi do starych ścieżek. Zatrzymać tylko procesy należące do likwidowanych checkoutów.

**Rezultat:** Dalsza praca odbywa się w jednym aktualnym katalogu i projekcie Codex, z działającym lokalnym środowiskiem.

## Zadanie 3: Domknąć dokumentację i potwierdzić zdalne zależności

**Pliki docelowego repo:** `README.md`, `docs/repository-migration.md`, niniejszy plan.

- [x] Zastąpić instrukcję przyszłego przepinania Builds w README opisem faktycznego połączenia: `chmura-blokserwis/main` → Worker `unisource-cloud` → `chmura.blokserwis.pl`.
- [x] Zapisać zakończone kroki migracji, lokalizację zachowanej pracy wycen i listę niewykonanych testów produkcyjnych. Odróżnić wcześniejszy sukces wdrożenia od nowej akceptacji transferów.
- [x] Sprawdzić aktywne GitHub Actions, webhooki, Deploy Hooks, integracje, zmienne i nazwy sekretów obu repo oraz ustawienia projektu w Codex. Usuwać stare połączenia dopiero po wskazaniu konkretnego nieużywanego odwołania. Nie usuwać wspólnej instalacji GitHub App ani współdzielonego tokena Builds.
- [x] Potwierdzić jedno produkcyjne źródło Builds, brak legacy wyzwalaczy i wyłączone previews. Sprawdzić, czy są aktywne buildy przed archiwizacją lub usuwaniem gałęzi.
- [x] Zrobić oddzielny PR dokumentacyjny i sprawdzić diff. Zastosować istniejące kontrole repo. Nie dodawać nowego systemu release, deploy ani ochrony gałęzi w ramach sprzątania.

**Rezultat:** Dokumentacja odpowiada konfiguracji, a zależności od starego repo są rozpoznane.

## Zadanie 4: Potwierdzić produkcję i zarchiwizować stare repo

- [x] Przeprowadzić krótki test produkcyjny na koncie i przestrzeni dopuszczonych do takich testów: logowanie, katalog prywatny i wspólny, upload małego pliku, download z kontrolą zawartości, podgląd oraz publiczny link i jego odwołanie. Posprzątać utworzone dane testowe. Jeśli brak takiego dostępu, zachować punkt jako jawnie otwarty i wstrzymać kroki uzależnione od akceptacji.
- [x] Potwierdzić najnowszy zielony CI i udane wdrożenie właściwego SHA z nowego repo. Sprawdzić HTTP 200 strony jako dodatkowy test dostępności.
- [x] Ponownie porównać śledzone drzewa obu repo i sprawdzić unikalne lokalne commity oraz otwarte PR/issues. Każdą nową różnicę sklasyfikować przed archiwizacją.
- [x] W `Dan1el-19/unisource-cloud` dodać krótką informację o przeniesieniu do `Dan1el-19/chmura-blokserwis`, z odnośnikiem do aktualnego repo. Następnie włączyć archiwizację repo. Pozostawić jego commity i tagi; nie usuwać repo.
- [x] Usunąć lokalną i zdalną `codex/replace-with-unisource-cloud` dopiero po usunięciu korzystającego z niej worktree i potwierdzeniu, że jej commit jest w aktualnym `main`. Zachować `codex/opencloud-evaluation` i nową gałąź z wycenami.

**Rezultat:** Stare repo stanowi czytelne archiwum; aktualny kod i wdrożenia mają jedno źródło.

## Zadanie 5: Usunąć zbędne lokalne checkouty i ocenić stary Worker

- [x] Po przeglądzie ignorowanych plików usunąć czysty worktree migracji przez `git worktree remove /Users/daniel/.codex/worktrees/chmura-repo-migration`. Worktree utworzono ręcznie; przed usunięciem potwierdzić, czy nie został później zarejestrowany w Codex, i w takim przypadku użyć właściwego mechanizmu aplikacji.
- [ ] Po archiwizacji zdalnego źródła i przełączeniu narzędzi usunąć katalog `/Users/daniel/Projects/unisource-cloud` wraz z jego zbędnymi zależnościami i artefaktami. Najpierw potwierdzić brak unikalnej pracy, potrzebnych plików ignorowanych i aktywnych odwołań. Nie wykonywać kasowania z aktywnego katalogu tego czatu.
- [x] Przed usunięciem starego Workera `chmura-blokserwis` sprawdzić domeny/route'y, workers.dev, bieżące użycie i inne zależności. Brak wyzwalaczy Builds został potwierdzony, ale to za mało, by uznać usługę za nieużywaną. Usunięcie dopiero po udokumentowaniu braku odbiorców i możliwości odtworzenia potrzebnej konfiguracji; przy niepewności pozostawić ten punkt otwarty.
- [x] Nie usuwać produkcyjnego Workera `unisource-cloud`, współdzielonych zasobów i danych dawnych magazynów na podstawie samej podobnej nazwy.
- [ ] Końcowo sprawdzić `git status`, `git worktree list`, gałęzie lokalne i zdalne, projekt Codex, stan archiwizacji repo, konfigurację Builds i dostępność produkcji. Zmierzyć odzyskane miejsce i odnotować faktyczne wyniki.

**Rezultat:** Jeden aktywny checkout frontendu; archiwalna praca pozostaje w Git; nieużywane zasoby są usunięte wyłącznie po sprawdzeniu zależności.

## Kolejność i granica wykonania

Wykonywać 1 → 2 → 3 → 4 → 5. Każdy etap kończy się sprawdzeniem wyniku przed kolejną mutacją. Gałęzie z unikalną pracą i stare repo są materiałem historycznym, nie kandydatami do automatycznego usunięcia. Wykonanie rozpoczęto na polecenie użytkownika 2026-11-04. Stan wykonania i pozostałe warunki opisuje `docs/environment-cleanup.md`; otwartych warunków nie uznawać za spełnione.

## Uzupełnienie wykonania — 2026-11-04

Użytkownik potwierdził pełny zakres testów produkcyjnych z pytania kontrolnego.
Akceptację zapisano jako zgłoszoną przez użytkownika, bez twierdzenia o nowych
transferach lub niezależnym porównaniu checksum przez agenta. Stare repo jest
zarchiwizowane z zachowaniem historii i tagów. Stary Worker został usunięty po
kontroli zależności, harmonogramów i ruchu. Pozostały lokalny katalog i projekt
źródłowy wymagają rozwiązania odwołań z czatów przez mechanizm zgody aplikacji.

Ze zarchiwizowanego checkoutu źródłowego usunięto wyłącznie ignorowane
`node_modules` i `.svelte-kit`; katalog zmniejszył się do około 3,4 MB. Pozostawiono
kod, historię Git, zapisy prac i samą ścieżkę wymaganą przez aktywne narzędzia.
