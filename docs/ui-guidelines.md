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
- Lokalnie menu działań zastąpiono pionowym panelem: testy z atrapą API sprawdzają wszystkie przyciski, pobieranie, Escape, fokus i zmianę szerokości przy 320 oraz 390 px. Nie jest to jeszcze dowód zachowania na produkcji ani na fizycznym telefonie. Pasek narzędzi katalogu nadal wymaga przebudowy.
- Katalog i menu: **częściowo zmienione lokalnie**. Menu działań i pierwszy wiersz katalogu mają testy geometrii; szczegółowa przebudowa katalogu pozostaje otwarta. Dialogi, transfery, podglądy, udostępnienia, publiczne linki, wyceny, kosz, ustawienia i stany sesji: **do sprawdzenia** dla pełnej macierzy planu; sam brak dowodu nie oznacza wykrytej usterki.
- Wyceny: przełącznik edycji i podglądu, sterowanie skalą oraz numerowane pola pozycji sprawdzono z atrapą RPC przy 320 i 390 px. Test obejmuje prawą kolumnę A4, powrót do edycji i otwarcie podglądu w iframe z sandboxem. Osobna próba sprawdza widoczność paska zapisu i aktywnego pola przy rozwiniętym transferze. Nie zastępuje to porównania z PDF, rzeczywistego backendu ani testu klawiatury na fizycznym urządzeniu.
- Transfery: zwinięte podsumowanie wskazuje zadania wymagające uwagi i magazyn podczas ponawiania. W teście nawigacji z atrapą API rozwinięty panel nie zasłania końca listy. Wznowienie i przełączanie magazynu na rzeczywistych usługach pozostaje osobnym odbiorem.
- Próby wizualne obu motywów, 768–1024 px, makiety katalogu i edytora, dane testowe oraz urządzenia fizyczne pozostają do wykonania. Wyniki z mocków, produkcji i urządzeń należy podawać oddzielnie.
