# Szlifowanie UI/UX Chmury Blokserwis — plan wdrożenia

> **Dla wykonawcy:** realizuj zadania kolejno z `superpowers:executing-plans`; użyj `superpowers:subagent-driven-development` wyłącznie po wyborze takiego trybu przez użytkownika. Checkboxy oznaczają pracę do wykonania, nie zakończone zmiany.

**Cel:** uporządkować desktop i mobile całej Chmury Blokserwis, usunąć przycięcia i przeładowanie interfejsu oraz poprawić codzienne operacje bez zmiany kontraktów usług.

**Architektura:** zachować SvelteKit, istniejące trasy, stan aplikacji i API. Wprowadzić wspólne tokeny oraz kilka komponentów dla powtarzających się zachowań; przenosić na nie kolejne widoki w zamkniętych etapach. Desktop i telefon mają wspólną stylistykę, ale układ dostosowany do zadania.

**Technologie:** Svelte 5, SvelteKit, TypeScript, Tailwind 4, phosphor-svelte, Vitest i Playwright; istniejący adapter Cloudflare. Nie planować migracji frameworka ani instalowania biblioteki UI.

**Specyfikacja:** wymagania i wartości docelowe opisuje część A tego dokumentu. Materiał wejściowy: cztery zrzuty użytkownika, przegląd produkcji desktop/mobile oraz `../UniSourceCFL/docs/operations/acceptance-2026-11-12.md` liczony względem katalogu repozytorium.

**Status:** kompletny plan do przeglądu, bez implementacji i wdrożenia. Wybory wizualne poniżej są rekomendacją autora planu, nie wcześniej zatwierdzonym projektem graficznym.

## Ograniczenia wspólne

- Właściciel zmian: `/Users/daniel/Projects/chmura-blokserwis`. UniSourceCFL i UniSourceGO pozostają usługami zależnymi; zmiany ich kontraktów nie są warunkiem tego planu.
- Zachować uprawnienia Main/prywatne, autoryzację, rewizje, idempotencję, paginację i stan transferów. Zmiana wyglądu nie zmienia semantyki operacji.
- Zachować istniejące ograniczenia przesyłania. Ten plan nie rozszerza odbioru na 10 GB i nie zmienia produkcyjnych limitów.
- Zachować rozpoczęte lokalne prace w `QuoteEditor.svelte`, `QuoteEditor.svelte.test.ts`, `QuotePreview.svelte`, `preview.ts`; najpierw porównać je z aktualną gałęzią.
- Nie generować od nowa modeli protobuf i nie zmieniać cen brutto ani obliczeń finansowych w ramach prac wizualnych.
- Polski interfejs; R2/RustFS pozostają widoczne w ustawieniach, szczegółach pliku i diagnostyce transferu, nie jako obowiązkowa informacja każdego wiersza.
- Jasny i ciemny motyw są równorzędne. Nie ograniczać odbioru do ciemnych screenshotów.
- Najpierw dokumentacja, izolowana gałąź i środowisko testowe; commity tylko plików danego zadania. Wdrożenie jest osobnym krokiem po odbiorze zmian.

## Najważniejsze ryzyka odbioru

1. Długie nazwy, adresy i tłumaczenia: nie chowają akcji poza ekranem i nie rozszerzają strony.
2. Transfer + otwarte okno + zapis wyceny + klawiatura ekranowa: nakładki nie zasłaniają aktywnej kontrolki ani głównej akcji.
3. Opóźnienie, błąd i konflikt rewizji: formularz nie gubi danych, nie zgłasza fałszywego sukcesu i pozwala ponowić właściwą operację.
4. Zmiana trasy, przestrzeni lub breakpointu: nie wycieka zaznaczenie, nie znika transfer, fokus trafia do właściwego miejsca.
5. Podgląd A4 i załączniki: dopasowanie strony nie ucina kolumn, nie osłabia sandboxu i nie jest przedstawiane jako dokładny wydruk PDF bez porównania.

---

## A. Projekt docelowy

### A1. Kierunek i zakres

Wybrany do zaplanowania wariant: etapowe uporządkowanie obecnego interfejsu. Same korekty marginesów nie rozwiązują hierarchii, a wymiana całej biblioteki UI zwiększa koszt i ryzyko bez konieczności produktowej.

Zakres obejmuje: szkielet aplikacji, logowanie i błędy sesji, Main i pliki prywatne, wyszukiwanie, filtry, zaznaczanie, foldery, przenoszenie, zmianę nazwy, kolizje przesyłania, kosz, transfery, podglądy, udostępnianie, zarządzanie linkami, publiczne pliki/foldery, listę i edycję wycen, PDF i rewizje, ustawienia oraz wszystkie stany przejściowe tych widoków.

Nie każdy z tych ekranów ma już potwierdzony błąd. Nieobejrzane stany należy zinwentaryzować w zadaniu 1; nie przedstawiać ich jako wykrytych usterek.

### A2. Wspólne zasady wizualne

| Element | Wartość / zasada docelowa |
| --- | --- |
| Odstępy | Skala 4, 8, 12, 16, 24, 32, 40 px; odstęp opisuje relację, nie wypełnia wolnej szerokości |
| Margines treści | 16 px poniżej 768 px, 24 px od 768 px, 32 px od 1280 px; bez dodatkowego paddingu na poziomie trasy |
| Odległość sekcji | 24 px mobile, 32 px desktop; wewnątrz grupy 12–16 px, etykieta–pole 8 px |
| Szerokość | Listy i edytor wycen wykorzystują dostępną szerokość; formularze ustawień maks. 960 px, wyrównane do tej samej lewej osi |
| Nawigacja | Sidebar 240 px od 1024 px; poniżej spokojny panel mobilny. Nagłówek mobilny 56 px |
| Typografia | Inter; tytuł strony 24/32 px mobile i 28/36 px desktop, sekcja 18/26 px, treść 14/20 px; pola mobile 16/24 px |
| Drobne opisy | 12/18 px tylko dla informacji pomocniczych; krytyczne błędy i wartości pozostają co najmniej 14/20 px |
| Kontrolki | 40 px desktop, co najmniej 44 × 44 px obszaru dotyku na mobile; jednolite ikony 18–20 px |
| Obramowania | Jeden kontener wizualny na grupę; bez ramki okna + ramki sekcji + ramki każdego wiersza |
| Zaokrąglenia | 8 px kontrolki, 12 px panele/dialogi, koło tylko tam, gdzie ma funkcję; bez losowej mieszanki kapsuł i kart |
| Kolory | Jedna paleta semantyczna: tło, powierzchnia, obramowanie, tekst, opis, akcent, sukces, ostrzeżenie, błąd |
| Akcje | Jedna dominująca akcja w grupie; pozostałe neutralne, destrukcyjne w menu lub osobnej sekcji |
| Ruch | 120–180 ms proste przejścia; bez kaskady sprężynujących elementów; respektować reduced-motion |
| Kontrast | Docelowo WCAG 2.2 AA: 4,5:1 zwykły tekst, 3:1 duży tekst i istotne elementy nietekstowe; pomiar obu motywów |

Wartości są w pikselach CSS, nie fizycznych pikselach zrzutu Retina. Przy zoomie i większym tekście kontrolki mogą rosnąć; nie blokować wysokości treści.

Breakpoints układu: telefon poniżej 768 px, pośredni 768–1023 px, sidebar od 1024 px. Edytor i podgląd obok siebie dopiero od 1280 px. Zachowanie przy 320 px jest obowiązkowe.

### A3. Szkielet i nawigacja

- Jedna oś nagłówka i treści we wszystkich trasach; `PageHeader` odpowiada za tytuł, opis i slot akcji, nie za pobieranie danych.
- Widoczna nazwa wspólnej przestrzeni: „Pliki wspólne”; trasy `/` i przekierowanie `/main` nie zmieniają się.
- Sidebar: jednobarwne ikony, jedna forma aktywnego elementu, narzędzia administracyjne i wylogowanie w grupie dodatkowej.
- Menu mobile: neutralne wiersze, bez kolorowych kół i cieni na każdym elemencie, przewijane przy małej wysokości; zamknięcie po wyborze, Escape i powrót fokusu.
- Zachować pamięć folderu i przewinięcia. Nie wprowadzać dolnej nawigacji w pierwszym etapie — kolidowałaby z transferami i paskiem wyceny.
- Jeden główny obszar przewijania aplikacji; nie zakładać, że przewija się `window`, bo obecny layout ma własny `scrollHost`.
- Link „Przejdź do treści”, widoczny fokus i poprawne `aria-current`; nie tworzyć zagnieżdżonych landmarków `main`.

### A4. Pliki i foldery

Desktop: tytuł/ścieżka i „Prześlij plik” + „Nowy folder”; poniżej zwarty pasek wyszukiwania, filtrów i sortowania. Bez rozrzucania kontrolek przez `justify-between` na całą szerokość.

Mobile: tytuł/ścieżka, główna akcja przesyłania, wyszukiwanie i jeden przycisk „Filtry i sortowanie”. Nowy folder dostępny w dodatkowych akcjach nagłówka. „Zaznacz” uruchamia osobny tryb; dopiero wtedy checkboxy, licznik i „Zaznacz wszystkie wczytane”.

- Pierwszy wiersz na zwykłej liście root przy 390 × 844 px i 100% zoom: górna krawędź nie niżej niż 300 px. Cel dotyczy stanu bez błędu i otwartego transferu, bez wymuszania limitu przy powiększeniu tekstu.
- Wiersz mobile: nazwa do dwóch linii, rozmiar i data modyfikacji w jednym wierszu pomocniczym, menu 44 × 44 px; około 72–88 px dla krótkiej nazwy. Pełna nazwa dostępna w szczegółach.
- Desktop: nazwa elastyczna, daty i rozmiar o spójnej szerokości; liczby wyrównane do prawej. Pobranie jako szybka akcja, pozostałe w menu. Akcje dostępne również bez hover.
- Menu mobile pionowe w panelu od dołu: nazwa elementu, Pobierz, Udostępnij, Przenieś, Zmień nazwę, Szczegóły; „Do kosza” oddzielone. Folder pokazuje wyłącznie obsługiwane czynności.
- Gesty mogą być skrótami, ale mają pełne odpowiedniki w menu. Żaden swipe nie wykonuje trwałego usunięcia. Instrukcja gestów trafia do pomocy.
- Wyszukiwanie nadal obejmuje przestrzeń, a nie tylko folder; pokazać jego zakres, aktywne zapytanie i „Wyczyść”. Enter i przycisk korzystają z tego samego handlera.
- Filtry mają widoczny stan aktywny i reset. Zmiana układu nie kasuje zapytania ani sortowania.
- Stany: pierwsze ładowanie, odświeżanie z zachowaniem listy, pusty folder, brak wyników, brak dostępu, błąd następnej strony i przycisk ponowienia.
- Szczegóły pliku zawierają pełną nazwę, ścieżkę, obie daty i provider z istniejących danych; nie wymagają nowego endpointu.

### A5. Dialogi, formularze i operacje zbiorcze

- `AppDialog` jest jedynym właścicielem powierzchni, ramki i paddingu. Wyeliminować powtórne opakowania występujące m.in. w tworzeniu folderu, rename i koszu.
- Desktop: rozmiary small 440 px, medium 640 px, large 880 px. Mobile: krótka decyzja w zwartym dialogu, menu akcji jako panel od dołu, rozbudowany formularz jako widok dialogowy zajmujący ekran.
- Nagłówek, treść i stopka mają zdefiniowane miejsce. Długi dialog przewija treść, nie chowa zamknięcia i przycisków. Unikać nakładania drugiego dialogu na pierwszy.
- Stałe błędy obok pola z `aria-describedby`; błąd operacji w formularzu; toast nie jest jedynym dowodem zapisu lub usunięcia.
- Enter zatwierdza tylko właściwy formularz. Escape nie przerywa operacji bez kontroli istniejącego `busy`; nie chować przyczyn blokady.
- Przenoszenie: czytelna przestrzeń docelowa, ścieżka i foldery; nazwa źródła, licznik, zakaz błędnego celu i blokady replacement pozostają aktywne.
- Operacje zbiorcze zachowują częściowe wyniki i „Ponów nieudane”; nie prezentować częściowego sukcesu jako pełnego.
- Kolizja uploadu: pełne, porównywalne opcje „Zachowaj oba”, „Zastąp”, „Anuluj”; wyjaśnienie, kiedy podmiana jest niedostępna.
- Trwałe usuwanie jasno odróżnione od kosza. Komunikat o przyjęciu zlecenia nie oznacza potwierdzonego fizycznego usunięcia z magazynu.

### A6. Transfery

- Domyślnie zwarty pasek podsumowania; rozwinięcie daje nazwę, cel, postęp, stan i właściwe akcje każdej pozycji.
- Przenieść dane techniczne do szczegółów; nie ukrywać faktu przełączenia magazynu ani potrzeby ponownego wyboru pliku.
- Osobno pokazywać przesyłanie, weryfikację i zakończenie; 100% wysłanych bajtów nie oznacza jeszcze ukończenia zadania.
- Pasek nie przykrywa końca listy ani aktywnego pola; layout rezerwuje miejsce zależnie od rzeczywistej wysokości.
- Przy otwartym dialogu transfer pozostaje aktywny, lecz nie konkuruje z jego przyciskami. Na wycenie pasek zapisu i transferów tworzą jeden przewidywalny stos, z uwzględnieniem safe-area.
- Zachować wznawianie, retry, anulowanie, wielokrotne pliki i stan po zmianie trasy. Nie przebudowywać upload-managera dla samych zmian wyglądu.

### A7. Podglądy plików i linki publiczne

- Obraz: dopasuj/powiększ, proporcje, pełna nazwa i pobranie bez znikających kontrolek.
- Audio/wideo: kontrolki mieszczą się na 320 px, stany ładowania/błędu, przewijanie i Range podlegają osobnemu testowi rzeczywistych usług.
- Tekst/kod: czytelny tekst, świadoma obsługa długich linii; przewijanie poziome wyłącznie w bloku kodu, nie całej stronie.
- PDF: czytelny fallback pobrania lub otwarcia, gdy przeglądarka nie obsługuje osadzenia. Nie dokładać renderera PDF bez wykazanej potrzeby.
- Publiczny plik/folder: ta sama typografia i kontrolki, prosty nagłówek, pełna nazwa, rozmiar i główne pobranie. Folder zachowuje ścieżkę i podglądy.
- Hasło, wstrzymanie, wygaśnięcie, wyczerpany limit, brak pliku i błąd sieci otrzymują odrębne komunikaty, o ile API pozwala odróżnić stan; inaczej uczciwy wspólny komunikat.
- Nie zwiększać liczników wizyt/pobrań przez dekoracyjne prefetch lub ponowne montowanie komponentu. Zachować dotychczasową ochronę publicznych endpointów.

### A8. Udostępnianie i zarządzanie linkami

- Gdy istnieje aktywny link, główny widok pokazuje go i „Kopiuj link”; poniżej inne linki. „Utwórz kolejny link” otwiera formularz.
- Gdy nie ma linku: akcja „Utwórz link” i krótkie podsumowanie domyślnego dostępu; nic nie tworzy się automatycznie po otwarciu dialogu.
- Ustawienia: Dostęp (hasło), Ograniczenia (termin, limit), Dodatkowe (etykieta, własny adres). Pola ukryte w sekcjach zachowują wartości; błędna sekcja otwiera się przy walidacji.
- Zastąpić „slug” nazwą „Własny adres linku”; przykładowy adres używa czytelnego `moj-link`, bez `%3Ctoken%3E`.
- Po utworzeniu przenieść fokus na wynik i pokazać kopiowanie. Kopiowanie ma status sukcesu lub błąd, nie samą zmianę koloru.
- Ujednolicić komponent prezentacji linku pomiędzy dialogiem a `/shares`: nazwa, stan, dostęp, termin/limit, statystyki, kopiowanie i dodatkowe akcje.
- „Kopiuj link” i „Kopiuj adres pobierania” mają rozróżnione opisy. Desktop może pokazywać statystyki w kolumnach; mobile zwarty blok i szczegóły.
- Nie utożsamiać „Unieważnij” i „Usuń link” bez sprawdzenia kontraktów `revoke`/`delete`. Wstrzymanie/wznowienie pozostaje osobną operacją; opisy wskazują odwracalność.
- Chronić przed przypadkową utratą linku; destrukcyjne akcje w dodatkowym menu z właściwym potwierdzeniem. Zachować expectedRevision i obsługę konfliktów.

### A9. Wyceny

Lista: wspólny nagłówek, „Nowa wycena”, Aktywne/Archiwum, spójny status. Pokazywać datę/klienta tylko jeśli istnieją w odpowiedzi API; nie tworzyć fikcyjnych metadanych.

Edytor desktop: przy >=1280 px edycja i podgląd w proporcji około 55/45, gap 24 px; sidebar jest wliczony w dostępną szerokość. Przy mniejszej szerokości przełącznik „Edycja / Podgląd”.

Edytor mobile:

- Jeden wiersz nagłówka z tytułem i menu dodatkowym; archiwizacja nie zajmuje głównego miejsca.
- Przełącznik „Edycja / Podgląd” przy początku widoku; wybór nie usuwa danych i nie tworzy nowej instancji stanu edytora.
- Dane, Pozycje, Treść, Dokumenty jako sekcje z szybką nawigacją; import XLSX zwijany, po zakończeniu zwięzłe podsumowanie.
- Nazwa pozycji w pełnym wierszu, ilość i cena obok siebie. Cel: <=200 px na pozycję z krótką nazwą przy 390 px, bez zmniejszania dotykowych pól i bez zewnętrznej ramki wokół każdej etykiety.
- Desktop: pozycje jako edytowalna tabela z nazwą, ilością, ceną, wartością i menu/usunięciem. Ten sam model `QuoteLine[]`, bez dwóch rozjeżdżających się kopii danych.
- Dane wejściowe i źródłowe wiersze XLSX zachowują powiązanie po dodaniu/usunięciu pozycji; poprawna kolejność tabulacji i etykiety numerowane pozycją.
- Kwoty widoczne formatowane konsekwentnie dla `pl-PL`, ale ich obliczanie i zapis pozostają zgodne z istniejącymi kontraktami; nie używać float jako nowej podstawy wyliczeń.
- **Zachować istniejący autosave.** Pokazać stały, dostępny status „Niezapisane zmiany / Zapisywanie… / Zapisano / Nie udało się zapisać” i ręczne ponowienie. Nie tworzyć drugiego timera autosave.
- Sticky pasek mobilny: status, „Zapisz szkic” oraz dodatkowa akcja zatwierdzenia. Bez zakrywania pól po otwarciu klawiatury; bez skakania fokusu po automatycznym zapisie.
- Zatwierdzenie używa istniejącej ścieżki flush i walidacji; konflikty rewizji zachowują wpisany tekst. Przełącznik podglądu nie zatwierdza ani nie generuje płatnych treści.
- Zakończona aktywność AI zwinięta do statusu i szczegółów; źródła dostępne bez dominowania nad formularzem.
- PDF, rewizje, archiwizacja, przywracanie i błędy generowania zachowują pełną funkcjonalność.

Podgląd dokumentu:

- Najpierw ocenić i wykorzystać lokalne `QuotePreview.svelte` / `preview.ts`; nie nadpisać ich kopią starego iframe.
- Cała szerokość A4 wraz z marginesami widoczna w trybie dopasowania. Tabela i wartości nie mogą wypaść poza widok.
- Kontrolki: „Dopasuj do szerokości”, 100%, powiększ/pomniejsz, otwarcie dokumentu w osobnym widoku. Przy powiększeniu świadome przewijanie wewnątrz podglądu.
- Zachować `sandbox`; nie polegać na dostępie do DOM iframe, który może być zablokowany. Skala i przewijanie są sterowane opakowaniem podglądu.
- Informacja, czy to szkic, która rewizja i czy podgląd jest aktualny względem zapisu. Oczekiwanie/błąd odświeżenia nie usuwa wpisanych danych.
- Porównać z prawdziwym PDF. Ciągły podgląd HTML może nie odwzorowywać podziałów stron i stopek; taką różnicę jawnie opisać, nie udawać dokładnej paginacji.

### A10. Kosz, ustawienia, sesja i komunikaty

- Kosz korzysta ze wspólnej listy, trybu zaznaczania i menu; główna akcja „Przywróć”, trwałe usunięcie drugorzędne i wyraźnie opisane.
- Ustawienia: Preferencje przesyłania osobno od Administracji magazynem; spójne sekcje, jednostki, bieżące użycie i walidacja. Uprawnienia i produkcyjne wartości pozostają bez zmian.
- Logowanie Clerk pozostaje wspieranym komponentem dostawcy. Ujednolicić wyłącznie otoczenie, błędy sesji, stany oczekiwania i powrotu do aplikacji.
- Komunikaty: sukces po odpowiedzi usługi, błędy z następnym krokiem, statusy `aria-live` bez czytania każdego procenta transferu.
- Loading nie powoduje dużych skoków układu; nie dodawać szkieletów do każdej drobnej operacji. Puste dane, brak wyników i brak uprawnień to różne stany.

## B. Pliki i granice odpowiedzialności

Ścieżki względem repozytorium frontendu. Wykorzystany snapshot referencyjny: `bd6b2dcd74bc5d681224a4c8d2078f245fb57da3` w `/private/tmp/cfl-acceptance-frontend`. Główny checkout ma starszą bazę i lokalne poprawki podglądu. Przed wykonaniem ustalić aktualny HEAD/origin i uzgodnić pliki, które od tego czasu się zmieniły.

| Obszar | Istniejące pliki do zmiany | Nowe pliki planowane |
| --- | --- | --- |
| Tokeny i zasady | `src/routes/layout.css`, `src/lib/quotes/ui.ts` | `docs/ui-guidelines.md` |
| Szkielet | `src/routes/+layout.svelte`, `src/lib/components/layout/{DesktopSidebar,MobileHeader,MobileDrawer,UploadNavigation}.svelte` | `src/lib/components/ui/PageHeader.svelte` |
| Formularze i nakładki | `src/lib/components/AppDialog.svelte`, istniejące formularze | `src/lib/components/ui/ActionMenu.svelte` |
| Katalog i kosz | `src/lib/components/StoragePage.svelte`, `src/routes/{+page,personal/+page,trash/+page}.svelte` | `src/lib/components/storage/{CatalogToolbar,EntryActions,EntryDetailsDialog}.svelte` |
| Transfery | `src/lib/components/UploadPanel.svelte` | brak nowego managera |
| Podglądy | `src/lib/components/{FilePreviewDialog,TextPreview,PublicFolder}.svelte`, `src/routes/s/[address]/+page.svelte` | tylko jeśli istniejący komponent wymaga wydzielenia wizualnego toolbaru |
| Linki | `src/lib/components/ShareLinksDialog.svelte`, `src/routes/shares/+page.svelte` | `src/lib/components/shares/ShareLinkCard.svelte` |
| Wyceny | `src/lib/quotes/{QuoteEditor,QuoteLines,QuoteAiActivity}.svelte`, `src/routes/wyceny/+page.svelte`, lokalne `QuotePreview.svelte`, `preview.ts` | `src/lib/quotes/QuoteActionBar.svelte` |
| Ustawienia | `src/lib/components/StorageSettingsPage.svelte` | brak |
| Weryfikacja | istniejące testy komponentowe i `e2e/*.spec.ts`, `playwright.config.ts` | `e2e/ui-layout.spec.ts`, `e2e/fixtures/ui-layout.ts` |

Nie rozbijać całego `StoragePage` ani `QuoteEditor` na nową architekturę. Wydzielenia dotyczą tylko powtarzalnego UI i obszarów, które trzeba niezależnie sprawdzić. Stan biznesowy pozostaje u obecnego właściciela.

## C. Zadania wykonawcze

### 1. Baza, inwentaryzacja i porównanie istniejącej pracy

**Pliki:** dokument planu, `docs/ui-guidelines.md`, istniejące konfiguracje/testy; bez zmian produktowych.

- [ ] Sprawdzić `AGENTS.md`, HEAD, origin i dirty tree obu powiązanych repozytoriów; utworzyć izolowaną gałąź `codex/ui-ux-polish` z bieżącej bazy, zachowując lokalne poprawki wycen.
- [ ] Porównać lokalny autosave/podgląd A4 z bazą. Zanotować, co już działa, co jest niewdrożone i co plan ma jedynie wystylizować.
- [ ] Zinwentaryzować wszystkie stany A1 w desktop/mobile; oznaczyć „potwierdzone”, „do sprawdzenia”, „do zmiany”. Dodać zrzuty referencyjne light/dark, również 768–1024 px.
- [ ] Zapisać wartości A2 w `docs/ui-guidelines.md` i przygotować dwa reprezentatywne układy do przeglądu wizualnego: katalog oraz edytor wyceny, każdy desktop/mobile. Nie budować odrębnego produktu demonstracyjnego.
- [ ] Ustalić testową bazę danych i własne pliki/wyceny. Zachować dowód wersji źródeł i środowiska; nie używać cudzych dokumentów jako fixture do mutacji.

**Odbiór:** kompletna mapa ekranów, zachowana lokalna praca, jasna baza porównawcza. Użytkownik może ocenić spójny kierunek przed rozprowadzeniem go po aplikacji.

### 2. Tokeny, nagłówki i szkielet

**Pliki:** `layout.css`, `+layout.svelte`, komponenty `layout/`, `quotes/ui.ts`; nowy `ui/PageHeader.svelte`; `Layout.svelte.test.ts`, `e2e/navigation.spec.ts`.

**Interfejs:** `PageHeader` przyjmuje `title: string`, `description?: string`, `actions?: Snippet`; nie dodaje paddingu trasy. Wspólne klasy pól i przycisków są zdefiniowane raz w CSS; istniejące eksporty `quotes/ui.ts` pozostają kompatybilne.

- [ ] Dodać regresję na aktywną trasę, otwarcie/zamknięcie menu, fokus po Escape i pamięć folderu przy przejściu Main/prywatne.
- [ ] Wprowadzić tokeny A2, spójny `PageHeader`, marginesy wyłącznie u właściciela layoutu oraz nazwy przestrzeni. Usunąć zagnieżdżone `main` w dotykanych widokach.
- [ ] Uprościć sidebar/drawer i animacje, uwzględnić małą wysokość i reduced-motion. Sprawdzić przewijanie rzeczywistego `scrollHost`.
- [ ] Uruchomić `pnpm test -- src/lib/components/Layout.svelte.test.ts` oraz `pnpm exec playwright test e2e/navigation.spec.ts`; obejrzeć light/dark przy 390, 1024, 1440 px.
- [ ] Zapisać oddzielny commit po przeglądzie; nie zatwierdzać zmian lokalnych niezwiązanych z zadaniem.

**Odbiór:** ta sama oś treści i hierarchia nagłówków, brak utraty nawigacji i transferów, klawiatura ma widoczny fokus.

### 3. Wspólne dialogi i menu akcji — usunięcie defektu mobile

**Pliki:** `AppDialog.svelte`, nowy `ui/ActionMenu.svelte`, `storage/EntryActions.svelte`, konsument w `StoragePage.svelte`; testy komponentowe i `e2e/ui-layout.spec.ts`.

**Interfejsy:** zachować obecne `labelledby`, `describedby`, `busy`, `alert`, `onclose`, `children` i kompatybilność `wide`; dodać `size?: 'sm' | 'md' | 'lg'`, `mobile?: 'dialog' | 'sheet' | 'fullscreen'`, `header?: Snippet`, `footer?: Snippet`. `ActionMenu` otrzymuje `label: string`, `triggerLabel: string`, `items: {id: string; label: string; disabled?: boolean; destructive?: boolean; run: () => void}[]`. Menu jest zamykane przed otwarciem kolejnego dialogu.

- [ ] Dodać test `file_actions_fit_320_and_390`: wszystkie akcje po otwarciu są w viewport, „Pobierz” jest widoczny i działa; brak poziomego scrolla strony. Regresja powinna najpierw odtworzyć obecny błąd.
- [ ] Dodać testy focus trap/restore, Escape, zachowania busy, długiej nazwy i zmiany szerokości przy otwartym menu.
- [ ] Wprowadzić panel akcji na mobile i menu desktop; usunąć poziomy rząd pięciu przycisków na telefonie.
- [ ] Przenieść ramkę/padding do `AppDialog`; zmigrować rename, nowy folder i potwierdzenia bez kasowania ich walidacji i handlerów.
- [ ] Uruchomić testy komponentowe i `pnpm exec playwright test e2e/ui-layout.spec.ts`; ręcznie sprawdzić 320 px i klawiaturę.
- [ ] Commit po odbiorze panelu i dialogów.

**Odbiór:** żadna akcja nie wypada poza ekran; pojedyncza warstwa powierzchni i spójne stopki, zachowane zabezpieczenia operacji.

### 4. Katalog, wyszukiwanie i zaznaczanie

**Pliki:** `StoragePage.svelte`, nowe `storage/{CatalogToolbar,EntryDetailsDialog}.svelte`; istniejące testy katalogu i `ui-layout.spec.ts`.

**Interfejs:** `CatalogToolbar` używa `query: string`, `filter: CatalogFileType`, `sort: CatalogSort`, `selectionMode: boolean`, `onsearch: (query: string) => void`, `onfilterchange: (filter: CatalogFileType) => void`, `onsortchange: (sort: CatalogSort) => void`, `onselectionchange: (enabled: boolean) => void`. `CatalogFileType` pochodzi z `#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js`, a `CatalogSort` z `#lib/cloud-state.svelte.js`. `EntryDetailsDialog` przyjmuje `entry: Entry` z tego samego modelu katalogu oraz `onclose: () => void`, bez pobierania drugiej kopii danych.

- [ ] Dodać testy: Enter/przycisk wyszukują identycznie, aktywne filtry mają reset, zaznaczanie zachowuje zakres „wczytane”, długa nazwa nie wypycha menu.
- [ ] Wprowadzić toolbar A4, zwarty wiersz mobile, tabelę desktop i szczegóły; usunąć provider i obie daty ze zwykłej karty mobile.
- [ ] Sprawdzić listę pustą, bez wyników, paginację z błędem i odświeżanie; nie usuwać już wyświetlonych wpisów przy retry następnej strony.
- [ ] Dodać pomiar pierwszego wiersza <=300 px w określonym stanie i widoczności ostatniej akcji przy 320 px. Testować rezultat, nie zestaw klas Tailwind.
- [ ] Uruchomić `pnpm test -- src/lib/components/StoragePage.svelte.test.ts` i `pnpm exec playwright test e2e/catalog-selection.spec.ts e2e/catalog-sort.spec.ts e2e/navigation.spec.ts e2e/ui-layout.spec.ts`.
- [ ] Commit po odbiorze tej samej listy w Main i prywatnych.

**Odbiór:** więcej treści w pierwszym ekranie; stabilna tabela i lista, bez zmiany zakresu wyszukiwania oraz semantyki selekcji.

### 5. Przenoszenie, kolizje i kosz

**Pliki:** `MoveEntryDialog.svelte`, `StoragePage.svelte`, `routes/trash/+page.svelte`; `e2e/move-entry.spec.ts`, `e2e/catalog-selection.spec.ts`, testy komponentowe.

- [ ] Dodać scenariusze długiej ścieżki, wielu wpisów, niedostępnego celu, blokady replacement i częściowej porażki.
- [ ] Przenieść formularze na kontrakt dialogu z zadania 3; poprawić grupowanie źródła, celu, błędów i stopki.
- [ ] Uporządkować opcje kolizji oraz kosz; zachować restore, retry i opisy nieodwracalności. Błąd pojedynczego elementu pozostaje przy tym elemencie.
- [ ] Uruchomić `pnpm exec playwright test e2e/move-entry.spec.ts e2e/catalog-selection.spec.ts` i właściwe testy `StoragePage`.
- [ ] Commit po próbie przeniesienia, przywrócenia i częściowego błędu na własnych danych.

**Odbiór:** użytkownik rozumie co, skąd i dokąd przenosi oraz jakie elementy operacji się nie powiodły.

### 6. Transfery i podglądy plików

**Pliki:** `UploadPanel.svelte`, `layout/UploadNavigation.svelte`, `FilePreviewDialog.svelte`, `TextPreview.svelte`; istniejące testy upload/preview/multipart i `ui-layout.spec.ts`.

- [ ] Dodać scenariusze długa nazwa, 20 zadań, retry, wymagany ponowny wybór pliku, transfer podczas dialogu i zmiana trasy.
- [ ] Uporządkować panel A6 i jego miejsce w layoucie; nie zmieniać protokołu ani kolejki. Powiadomienia nie mogą zasłonić przycisku menu lub stopki.
- [ ] Dostosować podglądy A7, formatki błędów oraz fallback PDF; zachować sandbox, signed URL i obsługę wygasłych adresów.
- [ ] Uruchomić `pnpm test -- src/lib/components/UploadPanel.svelte.test.ts` i `pnpm exec playwright test e2e/multipart.spec.ts e2e/preview.spec.ts e2e/ui-layout.spec.ts`.
- [ ] Ręcznie sprawdzić rzeczywiste audio/wideo i pobranie na obu providerach; Range/fallback oznaczyć osobno, jeśli brak świeżego dowodu. Commit.

**Odbiór:** właściwy stan transferu, wszystkie akcje dostępne, brak konfliktu panelu z dialogami; media mieszczą się w viewport.

### 7. Udostępnianie i lista linków

**Pliki:** `ShareLinksDialog.svelte`, `routes/shares/+page.svelte`, nowy `shares/ShareLinkCard.svelte`; `e2e/share-links.spec.ts`, `ui-layout.spec.ts`.

**Interfejs:** `ShareLinkCard` otrzymuje `share: ShareLink` z `#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js`, `entryName: string`, `busy: boolean` i callbacki `oncopy: (kind: 'page' | 'download') => void`, `onedit: () => void`, `onpause?: () => void`, `onrevoke?: () => void`, `ondelete?: () => void`. Wyświetla wyłącznie operacje dostępne w danym kontekście; nie wykonuje RPC samodzielnie.

- [ ] Sprawdzić kontrakty revoke/delete oraz wszystkie stany linku przed wyborem końcowego tekstu; zanotować różnice w `docs/ui-guidelines.md`.
- [ ] Dodać testy istniejącego linku, braku linków, błędu schowanego pola, długiego adresu, kopiowania nieudanego, konfliktu rewizji i błędu utworzenia.
- [ ] Wdrożyć układ A8 i kartę wspólną; na mobile kopiowanie istniejącego linku jest osiągalne bez przewijania formularza nowego linku.
- [ ] Usunąć techniczne placeholdery; zachować wszystkie opcje i rozróżnienie operacji. Otwieranie/zwijanie niczego nie publikuje.
- [ ] Uruchomić `pnpm exec playwright test e2e/share-links.spec.ts e2e/ui-layout.spec.ts`; sprawdzić obie trasy, light/dark i 320 px. Commit.

**Odbiór:** spójne nazwy i działania, szybkie kopiowanie, zachowana kontrola dostępu oraz limity.

### 8. Publiczne pliki i foldery

**Pliki:** `routes/s/[address]/+page.svelte`, `PublicFolder.svelte`, wspólne podglądy; istniejące public-share i serwerowe testy proxy.

- [ ] Rozszerzyć `e2e/public-share.spec.ts` o długą nazwę, folder, hasło, niedostępność i limit w szerokościach mobile.
- [ ] Uporządkować stronę A7 bez zmiany endpointów i momentu rejestrowania wizyty/pobrania.
- [ ] Uruchomić `pnpm exec playwright test e2e/public-share.spec.ts e2e/preview.spec.ts` i istniejące testy `routes/s` przez `pnpm test`.
- [ ] Przeprowadzić świeżą próbę w oddzielnej sesji bez zalogowanego użytkownika; użyć własnego linku i sprawdzić zmianę licznika po właściwej akcji. Commit.

**Odbiór:** odbiorca rozumie stan linku, potrafi pobrać plik i przejść po folderze; odświeżenie UI nie nabija dodatkowych pobrań.

### 9. Lista wycen, edycja i zapis

**Pliki:** `QuoteEditor.svelte`, `QuoteLines.svelte`, `QuoteAiActivity.svelte`, `quotes/ui.ts`, `routes/wyceny/+page.svelte`, nowy `QuoteActionBar.svelte`; testy komponentowe i quotes-integrated.

**Interfejsy:** zachować bindable `lines`, `sourceRows` i `onchange` w `QuoteLines`. `QuoteActionBar` jest prezentacyjny: `saveState: 'clean' | 'dirty' | 'saving' | 'error'`, `message?: string`, `disabled: boolean`, `onsave: () => void`, `onapprove: () => void`; nie zarządza autosave i nie wywołuje API. Widok `editing/preview` jest stanem UI tego samego edytora.

- [ ] Dodać regresje autosave: opóźniona odpowiedź nie nadpisuje późniejszej edycji, konflikt zachowuje tekst, błąd ma retry; zmiana trybu nie resetuje danych, timerów i rewizji.
- [ ] Dodać testy numerowanych etykiet, sourceRows po usunięciu pozycji, ilości ułamkowych, długich nazw i pustej wartości według istniejącej walidacji.
- [ ] Wprowadzić tabelę desktop i zwarte pozycje mobile, układ sekcji oraz zwijany import/AI. Nie zmieniać obliczeń ani zapisu liczb przy formatowaniu widoku.
- [ ] Uporządkować listę wycen, archiwum, menu akcji i status zapisu. Sticky pasek ma wspólny sposób rezerwacji miejsca z transferami.
- [ ] Uruchomić `pnpm test -- src/lib/quotes/QuoteEditor.svelte.test.ts src/lib/quotes/QuoteAiActivity.svelte.test.ts` i `pnpm exec playwright test e2e/quotes-integrated.spec.ts e2e/ui-layout.spec.ts` w istniejącym trybie fixture dla wycen.
- [ ] Ręcznie sprawdzić edycję ośmiu pozycji, zapis i konflikt, przełączanie podglądu oraz archiwum. Nie generować ponownie płatnego AI do testu wyglądu. Commit.

**Odbiór:** pozycje mieszczą się w przyjętej gęstości, zapis pozostaje dostępny, a poprawiony wygląd nie wprowadza utraty treści.

### 10. Podgląd A4, PDF i rewizje

**Pliki:** lokalne `QuotePreview.svelte`, `preview.ts`, konsument `QuoteEditor.svelte`; testy lokalnego podglądu i `e2e/quotes-integrated.spec.ts`.

**Interfejs:** zachować `QuotePreview({html: string})`; skalę i tryb dopasowania trzyma komponent podglądu. Prezentacja wersji, dirty i aktualności należy do edytora, nie parsera HTML.

- [ ] Dodać fixture A4 z długą tabelą, marginesami i stopką oraz regresję widoczności prawej kolumny w dopasowaniu przy 320/390 px.
- [ ] Zweryfikować lokalny parser marginesów, zachowanie fallbacku i skali; rozszerzyć istniejącą poprawkę o kontrolki i dostępny tryb podglądu, zamiast pisać konkurencyjne rozwiązanie.
- [ ] Zapewnić przewijanie powiększonej strony bez utraty kontrolek i poprawny powrót do edycji. Sprawdzić odświeżenie szkicu i przełączanie rewizji przy opóźnionych odpowiedziach.
- [ ] Uruchomić testy `QuoteEditor` i `quotes-integrated`; porównać wizualnie pełny podgląd z pobranym PDF wielostronicowym. Osobno udokumentować marginesy, stopki, podziały i formatowanie kwot.
- [ ] Jeśli różnica wynika z szablonu backendu, opisać konkretny problem i osobne zadanie właściciela; nie edytować szablonów UniSourceGO w tym etapie. Commit.

**Odbiór:** w trybie dopasowania nic nie jest przycięte, podgląd wskazuje właściwą wersję, a znane różnice wobec PDF są jawne.

### 11. Ustawienia, sesja i pełne stany aplikacji

**Pliki:** `StorageSettingsPage.svelte`, otoczenie Clerk w `+layout.svelte`, wszystkie dotknięte komunikaty; istniejące testy Settings/Layout.

- [ ] Sprawdzić puste i błędne wartości, limit poniżej użycia, brak roli administratora, odrzucenie zapisu, sesję pending i błąd ładowania Clerk.
- [ ] Ujednolicić sekcje A10, pola, jednostki, komunikaty i statusy. Nie stosować globalnego `min-height` do wszystkich linków tekstowych, jeśli deformuje treść; obszar dotyku definiować świadomie dla interaktywnych kontrolek.
- [ ] Uruchomić `pnpm test -- src/lib/components/StorageSettingsPage.svelte.test.ts src/lib/components/Layout.svelte.test.ts`; przejść widoki klawiaturą i przy zwiększonym tekście.
- [ ] Commit po kontroli obu motywów i zachowania uprawnień.

**Odbiór:** ekran ustawień nie wygląda jak osobny produkt, a ograniczenia i skutki operacji są zrozumiałe.

### 12. Odbiór całości i wydanie

**Pliki:** `e2e/ui-layout.spec.ts`, fixture, ewentualnie `playwright.config.ts`, dokument odbioru i `docs/ui-guidelines.md`.

- [ ] Zebrać deterministyczne dane: pusto, 2/50/200 elementów, długa nazwa, wiele transferów, 0/1/8/30 pozycji wyceny, aktywne i niedostępne linki. Nie mnożyć pełnego iloczynu wszystkich stanów i rozmiarów.
- [ ] Dodać regresje geometrii tylko dla potwierdzonych problemów i kluczowych granic. Screenshoty referencyjne kluczowych widoków zaakceptować wizualnie; nie aktualizować ich automatycznie po niepowodzeniu.
- [ ] Wykonać zestaw komend z części D i obejrzeć kluczowe ekrany w Browser. Wszystkie pominięte testy mają nazwę i uzasadnienie.
- [ ] Wykonać próbę na fizycznym Androidzie i iPhonie/Safari: klawiatura, safe-area, scroll formularza, obrót, pobranie i media. Brak urządzenia oznacza jawną lukę, nie „zaliczone przez emulację”.
- [ ] Przeprowadzić przegląd spójności całych przepływów oraz kontrolę dostępności. Ocenić wynik na podstawie scenariuszy, nie tylko screenshotów bez interakcji.
- [ ] Zaktualizować raport: błędy zamknięte, ograniczenia, SHA, dowody, porównania przed/po. Sprawdzić diff i zakres zmian przed integracją.
- [ ] Po akceptacji zbudować i wdrożyć zgodnie z obecną ścieżką wydawniczą; potwierdzić wersję produkcji. Poprzednia wersja stanowi drogę rollbacku; nie łączyć wdrożenia z migracją danych.
- [ ] Produkcyjny smoke na własnych danych: nawigacja, katalog, upload/download, link w sesji anonimowej, zapis/podgląd wyceny. Posprzątać własne dane zgodnie z wymaganiami potwierdzenia trwałego usuwania.

## D. Macierz weryfikacji

### Rozmiary i środowiska

| Zakres | Próby |
| --- | --- |
| Pełny przegląd kluczowych ekranów | 390 × 844, 1440 × 900, light + dark |
| Granice geometrii | 320 × 740, 360 × 800, 768 × 1024, 1024 × 768, 1280 × 800, 1920 × 1080 |
| Dostępność | Klawiatura, widoczny fokus, Escape, focus restore, powiększenie 200%, reduced-motion, pomiar kontrastu |
| Rzeczywisty mobile | Android Chrome i iPhone Safari, klawiatura, obrót i pobrania |
| Przeglądarki automatyczne | Istniejące projekty Chromium, Firefox, mobile; Safari urządzeniowe nie jest zastępowane Chromium |
| Usługi | R2/RustFS oraz wspólne/prywatne dla zmienionych przepływów; mock nie jest dowodem produkcyjnego transferu |

### Komendy przed integracją

Uruchomić z repozytorium frontendu, w wersji Node i pnpm wymaganej przez aktualną bazę:

```text
pnpm proto:check
pnpm proto:check:backend /Users/daniel/Projects/UniSourceCFL
pnpm check
pnpm lint
pnpm test
pnpm build
CI=1 pnpm exec playwright test --workers=3
git diff --check
```

Porównanie protobuf wykonać do uzgodnionego aktualnego checkoutu backendu, jeżeli wskazany katalog pozostaje na starszej rewizji. Nie kopiować plików generowanych w celu ukrycia rozbieżności. Jeśli kontrakty się nie zmieniły, nie dodawać obowiązku pełnego CI backendu do każdego zadania CSS.

Przy pisaniu Svelte korzystać z dokumentacji i autofixera wymaganych przez repozytorium, jeżeli narzędzia są dostępne. Niedostępność narzędzia odnotować i wykonać istniejące check/lint/build; nie twierdzić, że autofixer uruchomiono.

### Kryteria końcowe

- [ ] Zero przyciętych akcji i niezamierzonego poziomego przewijania strony od 320 px. Świadomy scroll kodu i powiększonego dokumentu pozostaje lokalny.
- [ ] Tytuły, osie treści, paddingi, kontrolki i kolory pochodzą ze wspólnych zasad; wyjątki mają funkcjonalny powód w `ui-guidelines.md`.
- [ ] Katalog mobile spełnia cel pierwszego wiersza i gęstości; filtry oraz zaznaczanie nie dominują nad treścią.
- [ ] Gotowy link można szybko skopiować z dialogu i listy udostępnień; żadne otwarcie UI samo nie rozszerza dostępu.
- [ ] Wycena pozwala edytować, sprawdzić status zapisu i otworzyć kompletny podgląd bez przewijania całego dokumentu w obie strony.
- [ ] Autosave, konflikt rewizji, retry, sourceRows, zatwierdzenie, archiwum i PDF zachowują dotychczasową semantykę.
- [ ] Klawiatura ekranowa, transfery, powiadomienia i paski akcji nie zasłaniają aktywnych kontrolek.
- [ ] Oba motywy, duży tekst, fokus i komunikaty błędów mają dowody weryfikacji; brak pomiaru nie jest przedstawiany jako zgodność WCAG.
- [ ] Dotychczasowe testy przechodzą; nowe testy dowodzą zachowania, a nie kopiują implementacji.
- [ ] Raport oddziela próby lokalne, mockowane, rzeczywiste usługi i fizyczne urządzenia; wszystkie luki odbioru są jawne.

## E. Kolejność i zależności

1 → 2 → 3 → 4 → 5. Po 3 można wykonać 6–8; zalecana kolejność pozostaje 6 → 7 → 8, żeby utrzymać wspólną stylistykę. Następnie 9 → 10 → 11 → 12. Każdy etap kończy się działającym produktem i przeglądem, bez długotrwałego utrzymywania drugiego interfejsu.

Najpierw zamknąć defekty menu i podglądu; potem oceniać gęstość i estetykę na gotowych przepływach. Nie deklarować terminów przed zadaniem 1: koszt zachowania lokalnego podglądu, testów urządzeniowych i istniejących stanów błędów trzeba ustalić z bieżącej bazy.

## F. Wynik przeglądu planu

Zakres desktop/mobile i wszystkie zgłoszone problemy mają właściciela zadania. Przeanalizowano ryzyka długich danych, nakładek, błędów, nawigacji i podglądu; przypisano je do testów w zadaniach 2–10. Plan zachowuje autosave i lokalną poprawkę A4, nie wymaga migracji backendu ani nowej biblioteki UI. Otwarte pozostają akceptacja proponowanego kierunku wizualnego i potwierdzenie zachowania na fizycznych urządzeniach podczas realizacji.
