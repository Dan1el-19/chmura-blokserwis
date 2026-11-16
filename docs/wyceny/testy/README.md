# Test wizualny wzorca wyceny - 15 listopada 2026

To raport pierwszej serii. Aktualny mechanizm opisuje [paginacja w wersji 2](PAGINACJA.md): planowanie podziałów całego dokumentu, ocena ostatniej strony i kontrolowana zmiana wielkości tytułu/nagłówków.

Test dotyczy prototypu układu PDF na podstawie zatwierdzonego wzorca. Nie jest testem działającego generatora UniSourceGO ani jego integracji z Chmurą. Dane, powtórzenia produktów i długie opisy są syntetyczne. Oryginalny `../wzor-glowny.pdf` pozostaje punktem odniesienia.

## Wyniki

| Przypadek | Zwykłe odstępy | Wybrany układ | Wynik |
| --- | --- | --- | --- |
| 5 pozycji, 3 akapity zakresu | 1 strona | Zwykły | Zachowane proporcje wzorca |
| 7 pozycji, granica strony | 2 strony | Umiarkowanie zwarty, 1 strona | Usunięta prawie pusta druga strona z 10 słowami |
| 8 długich nazw i długi tytuł | 2 strony | Zwykły, 2 strony | Nazwy zawijają się; całe wiersze przechodzą na kolejną stronę |
| 5 pozycji i 8 rozbudowanych akapitów zakresu | 2 strony | Zwykły, 2 strony | Krótkie podsekcje nie są rozcinane |
| Ilość ułamkowa i wartości ponad 12 mld zł w wierszu | 1 strona | Zwykły | Kwoty i suma mieszczą się w kolumnach |
| 30 pozycji i 3 akapity zakresu | 3 strony | Zwarty, 2 strony | Powtarzany nagłówek tabeli, komplet wierszy i zakresu |
| Jeden akapit zakresu około 10 tys. znaków | 3 strony | Zwykły, 3 strony | Akapit dłuższy od strony dzieli się; nie stosujemy bezwzględnego zakazu podziału |
| 1 pozycja i 1 akapit | 1 strona | Zwykły | Naturalna wolna przestrzeń; bez sztucznego powiększania treści |
| Brak pozycji i zakresu | 1 strona | Diagnostyczny | Technicznie mieści się, ale pustych sekcji i sumy 0 zł nie należy uznawać za gotowy dokument |
| Identyfikator bez spacji, ponad 180 znaków | 2 strony | Umiarkowanie zwarty, 1 strona | Awaryjne łamanie słowa; bez wyjścia poza kolumnę |

Wszystkie 10 przypadków porównano w trzech zestawach odstępów. Wybór oparto na liczbie stron rzeczywiście wyrenderowanych przez Chromium, nie tylko na oszacowaniu wysokości DOM. Przy tej samej liczbie stron wygrywa luźniejszy układ.

## Zasady sprawdzone w prototypie

- Format A4, marginesy boczne 19 mm, górny 17 mm; dolne 30 mm rezerwuje miejsce na osobną stopkę. Treść i stopka nie korzystają ze wspólnego obszaru.
- Czcionka treści nie jest zmniejszana pomiędzy wariantami. Zmieniane są odstępy przed tytułem, pomiędzy sekcjami i pionowe paddingi wierszy. Minimalny padding wiersza wynosi 1 mm.
- Nagłówek tabeli powtarza się na następnych stronach. Wiersze pozycji pozostają w całości, suma nie jest celowo odrywana od końca tabeli.
- Krótkie akapity zakresu pozostają razem. Bardzo długi akapit może się dzielić, z kontrolą wdów i sierot.
- Brak `overflow:hidden`, przycinania tekstu i skracania nazw wielokropkiem.
- Numeracja stopki jest generowana przez silnik druku. Odchylenie poziome środka licznika od środka strony wyniosło 0,15 punktu PDF, około 0,05 mm.

Kontrola geometrii HTML nie wykazała poziomego przepełnienia. Kontrola PDF nie wykazała tekstu poza badanymi marginesami, braków nazw, opisów ani akapitów w danych testowych. Każda strona miała stopkę i właściwy licznik. Wszystkie strony wyrenderowano do PNG i sprawdzono na zbiorczym podglądzie; istotne podziały sprawdzono również osobno.

## Ograniczenia i dalsze wymagania

1. Font Inter używany w makiecie wizualnie renderuje się poprawnie, ale przy ekstrakcji niektóre myślniki, znak mnożenia i cudzysłów otrzymują inne kody znaków. Audyt normalizuje te znane różnice. Przed wdrożeniem należy poprawić font lub jego osadzenie, aby kopiowanie i wyszukiwanie zachowywało oryginalne znaki.
2. Wycena bez pozycji wymaga odrębnej reguły: finalizacja powinna być zablokowana albo dokument powinien być jednoznacznie szkicem. Układ pustego dokumentu w pakiecie jest przypadkiem diagnostycznym.
3. Ekstremalnie długi identyfikator mieści się po podziale, ale pozostaje mało czytelny. Można przenieść kod do opisu pozycji; generator nie powinien sam zmieniać nazwy produktu.
4. Długi, jednolity akapit jest ścianą tekstu mimo poprawnego podziału. Generator powinien przyjmować strukturę podsekcji, a nie dopisywać ani streszczać treści samodzielnie.
5. Nie zbadano pojedynczego wiersza pozycji wyższego od całej strony ani dowolnej długości danych sprzedawcy. Takie przypadki wymagają dodatkowych reguł lub walidacji.
6. Kwoty w skrypcie służą wyłącznie makiecie. Obliczenia finansowe docelowego generatora muszą pozostać po stronie backendu, z jego arytmetyką dziesiętną.
7. Chromium z Playwright jest tutaj narzędziem testowym. Po implementacji należy powtórzyć testy przez rzeczywistą ścieżkę generatora i Gotenberg, z tymi samymi fontami i opcjami druku.

## Odtworzenie

Z katalogu głównego repozytorium, z zainstalowanym Playwright:

```sh
node docs/wyceny/testy/stress-pdf.mjs /tmp/wyceny-stress
python3 docs/wyceny/testy/audit-pdf.py /tmp/wyceny-stress
```

Python wymaga `pdfplumber`, Pillow, a `pdftoppm` musi być w PATH. Skrypt JS odczytuje istniejące logo i font z lokalnego checkoutu `/Users/daniel/Projects/UniSourceGO/internal/quotes/assets`; nie modyfikuje tego repozytorium. `wzor.css` jest zapisem stylu makiety, a reguły testowej paginacji znajdują się w `stress-pdf.mjs`.

Artefakty tej sesji: `/Users/daniel/.codex/visualizations/2026/11/14/01a1da2e-90c6-77a2-8cda-d1a16c34923a/wyceny-stress/`. Katalog zawiera PDF-y przypadków, porównanie granicy strony przed korektą, zbiorczy pakiet PDF z zakładkami, podgląd PNG oraz wyniki `geometry.json`, `audit.json` i dane `fixtures.json`.
