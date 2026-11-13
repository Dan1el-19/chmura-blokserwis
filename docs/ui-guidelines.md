# Zasady UI Chmury Blokserwis

Dokument roboczy dla planu `docs/superpowers/plans/2026-11-12-ui-ux-polish.md`. Wartości są celem, a nie deklaracją, że wszystkie widoki już je spełniają.

## Wspólne zasady

- Odstępy: 4, 8, 12, 16, 24, 32 i 40 px. Margines treści: 16 px poniżej 768 px, 24 px od 768 px i 32 px od 1280 px; właścicielem marginesu jest layout.
- Przerwy sekcji: 24 px na telefonie, 32 px na desktopie; wewnątrz grupy 12–16 px, między etykietą a polem 8 px.
- Sidebar ma 240 px od 1024 px, nagłówek mobilny 56 px. Edycja i podgląd wyceny obok siebie od 1280 px. Graniczna szerokość widoku: 320 px.
- Inter: tytuł strony 24/32 px na telefonie i 28/36 px na desktopie, sekcja 18/26 px, treść 14/20 px; pola mobilne 16/24 px. Pomocniczy tekst może mieć 12/18 px, lecz błędy i istotne wartości co najmniej 14/20 px.
- Kontrolki mają 40 px na desktopie, a ich mobilny obszar dotyku co najmniej 44 × 44 px. Promień kontrolki: 8 px, panelu i dialogu: 12 px.
- Jedna powierzchnia grupuje powiązane elementy; jedna akcja dominuje, pozostałe są neutralne. Ruch 120–180 ms z uwzględnieniem reduced-motion.
- Oba motywy mają równą wagę. Docelowy kontrast WCAG 2.2 AA: 4,5:1 dla zwykłego tekstu i 3:1 dla dużego tekstu oraz istotnych elementów nietekstowych. Wymaga osobnego pomiaru.

## Baza i stan rozpoznania

- Baza izolowanej gałęzi: frontend `bd6b2dcd74bc5d681224a4c8d2078f245fb57da3` (lokalnie zapisany `origin/main`). Główny checkout `8a4d7c8` zawiera wcześniejsze niezapisane zmiany wycen, skopiowane do worktree bez usuwania oryginałów.
- Lokalna poprawka A4 dodaje ekranowe marginesy na podstawie `@page`, skaluje opakowanie i zachowuje pusty sandbox iframe. To ciągły HTML, nie potwierdzone odwzorowanie podziałów stron i stopek PDF. Została zapisana lokalnie w commicie `d5d1898`; nie ma dowodu wdrożenia.
- Autosave edytora korzysta z istniejącego timera, rewizji i ponowienia po kolejnej edycji. Dalsze zmiany wyglądu muszą zachować ten mechanizm; opóźnienia, konflikty i odświeżanie podglądu wymagają testów wymienionych w planie.
- Raport odbioru z 12 listopada potwierdza na produkcji mobilne menu z przyciskiem „Pobierz” poza ekranem przy 320 px oraz nadmierną wysokość narzędzi katalogu. Raport obejmował 320, 390 i 1440 px, nie fizyczne urządzenia ani pełny audyt dostępności.
- Katalog: lokalnie przebudowano narzędzia mobilne, wiersze i menu działań; desktop ma szybkie pobieranie oraz menu z pozostałymi operacjami i szczegółami. Testy z atrapą API obejmują pierwszy wiersz przy 390 px, akcje przy 320/390/1280 px, fokus i Escape. Testy komponentowe obejmują zachowanie wyszukiwania i ponawianie błędów ładowania. Pełna macierz rozmiarów i dostępności oraz usługi produkcyjne pozostają do sprawdzenia.
- Wyceny: przełączanie, zapis ośmiu pozycji, sterowanie skalą, tabela pozycji i układ przy 320/390/1280/1440 px są objęte testem z atrapą RPC. Przy 320 i 390 px sprawdzono prawą kolumnę również na końcu 60-wierszowej tabeli oraz dostęp do stopki HTML; osobna próba obejmuje pasek zapisu i aktywne pole przy rozwiniętym transferze. Testy komponentowe obejmują konflikt zapisu, opóźniony podgląd i błąd odświeżania. Nie jest to porównanie z pobranym PDF, próba rzeczywistego backendu ani test klawiatury na fizycznym urządzeniu.
- Transfery: zwinięte podsumowanie wskazuje zadania wymagające uwagi i magazyn podczas ponawiania. W teście nawigacji z atrapą API rozwinięty panel nie zasłania końca listy. Wznowienie i przełączanie magazynu na rzeczywistych usługach pozostaje osobnym odbiorem.
- Kontrola kontraktów: `pnpm proto:check` przeszło. Porównanie z `/Users/daniel/Projects/UniSourceCFL` wykazało różnice w trzech plikach proto; ten checkout był 15 commitów za `origin/main` (lokalny HEAD `2174a3a`). Snapshot `/private/tmp/cfl-acceptance-backend` na `96fcc4a` odpowiadał zdalnemu `main` w chwili sprawdzenia i `pnpm proto:check:backend /private/tmp/cfl-acceptance-backend` przeszło. Nie jest to potwierdzenie wersji backendu na produkcji.

## Operacje na linkach — kontrakt referencyjny

W lokalnym snapshocie UniSourceCFL `96fcc4a` unieważnienie ustawia `revoked_at` i `released_at` oraz usuwa granty, pozostawiając rekord linku; ta operacja nie przyjmuje rewizji. Usunięcie oznacza rekord jako usunięty, zwalnia adres i unieważnia granty, z kontrolą `expectedRevision`. Wstrzymanie jest zmianą ustawienia `paused` z kontrolą rewizji i może zostać odwrócone, natomiast unieważnionego linku nie można wznowić przez tę zmianę. To opis kodu referencyjnego, nie potwierdzenie aktualnej wersji produkcji.
- Próby wizualne obu motywów, 768–1024 px, makiety katalogu i edytora, dane testowe oraz urządzenia fizyczne pozostają do wykonania. Wyniki z mocków, produkcji i urządzeń należy podawać oddzielnie.
