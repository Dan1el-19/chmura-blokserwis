# Paginacja i proporcje - wersja 2

Lokalny prototyp generatora PDF rozwijający zatwierdzony wzorzec. Kod znajduje się w `adaptive-pdf.mjs` i `pagination.mjs`; aplikacja Chmura i backend UniSourceGO nie zostały tutaj podłączone do tego mechanizmu.

## Co zostało zmienione

Poprzedni skrypt porównywał głównie liczbę stron. Nowa wersja planuje podział całej treści, uwzględniając wysokość rzeczywiście złożonych elementów, nagłówki powtarzane na dalszych stronach i rezerwę na stopkę.

1. Mierzy logo, metrykę dokumentu, tytuł, wiersze cenowe, sumę i akapity z użyciem załadowanego fontu w Chromium. Przed pomiarem czeka na font i obraz logo.
2. Wyznacza możliwe podziały pomiędzy elementami i wybiera podział o najmniejszej liczbie stron. W obrębie tej liczby stron ocenia wolną przestrzeń i szczególnie mocno obciąża wynik za ostatnią stronę zapełnioną poniżej 40% obszaru treści. Dzięki temu może przenieść więcej treści na ostatnią stronę zamiast wypełniać poprzednią do końca.
3. Zwykły wiersz pozycji jest niepodzielny. Suma stanowi część bloku ostatniego wiersza, więc nie może utworzyć osobnej kartki. Nagłówek sekcji zawsze trafia na stronę razem z treścią.
4. Krótkie podsekcje zakresu są niepodzielne. Bardzo długi akapit jest dzielony według rzeczywistych linii tekstu, w fragmentach po co najmniej trzy linie. Fragmenty zachowują kolejność i pełny tekst; nie powstaje streszczenie. Na kolejnych stronach powtarza się nagłówek „Zakres”.
5. Pojedynczy wiersz wyższy od strony może zostać podzielony na fragmenty nazwy/opisu. Ilość, cena i wartość są pokazywane raz, przy pierwszym fragmencie. Suma pozostaje przy ostatnim fragmencie ostatniej pozycji.
6. Porównuje sześć kombinacji: trzy gęstości odstępów i dwa zestawy rozmiarów tytułu/nagłówków. Ciaśniejszy lub mniejszy wariant otrzymuje karę estetyczną, więc nie jest wybierany bez korzyści dla liczby stron lub jakości podziału.
7. Buduje jawne strony A4 i sprawdza, czy rzeczywisty skład każdej strony zgadza się z planem z dokładnością do 2 px. Kontroluje również kolizję ze stopką, przepełnienia kolumn liczbowych i liczbę stron finalnego PDF-a. Błąd kończy generowanie zamiast ukrywać treść.

Wymiary: marginesy boczne 19 mm, górny 17 mm, dolna rezerwa 30 mm. Obszar planowania ma 249 mm wysokości, co zostawia dodatkowy 1 mm tolerancji na zaokrąglenia druku.

## Wielkość tekstu

| Element | Zwykły | Alternatywny |
| --- | --- | --- |
| Tytuł | 25 pkt | 22 pkt |
| Nagłówki „Wycena”, „Zakres” | 14 pkt | 12,5 pkt |
| Suma | 22 pkt | 20 pkt |
| Nazwy pozycji | 9 pkt | 9 pkt |
| Opisy pozycji | 7,5 pkt | 7,5 pkt |
| Treść zakresu | 8,5 pkt | 8,5 pkt |

Skrypt audytu sprawdza te dolne granice na stylach rzeczywiście użytych do składu. Tekst pozycji i opisów nie jest zmniejszany, aby wymusić dodatkową zawartość na stronie. Jednostronicowe dokumenty nie są sztucznie rozciągane w pionie.

## Wyniki testów

16 przypadków pozytywnych, każdy z sześcioma kombinacjami stylu. Dodatkowo sprawdzono odrzucenie dokumentu bez pozycji i bez zakresu. Dla wybranych przypadków powstał także kontrolny PDF z zachłannym podziałem: wypełnij stronę, a resztę przenieś na następną. Kontrola używa tych samych bloków, fontów i wymiarów, więc pokazuje różnicę wynikającą z planowania podziałów.

| Przypadek | Strony | Ostatnia strona przy podziale zachłannym | Ostatnia strona po planowaniu |
| --- | --- | --- | --- |
| Długie nazwy i tytuł | 2 | 56% | 75% |
| Rozbudowany zakres | 2 | 43% | 65% |
| Akapit około 10 tys. znaków | 3 | 38% | 80% |
| Końcowe pozycje z sumą | 2 | 34% | 69% |
| Krótki zakres po długiej tabeli | 2 | 42% | 71% |
| Bardzo długi tytuł | 2 | 22% | 60% |
| 40 pozycji i zakres | 3 | 81% | 91% |

Procent oznacza wysokość złożonej treści względem dostępnego obszaru strony, a nie udział pikseli zadrukowanych tuszem. W przypadku jednostronicowego dokumentu nie jest narzucane minimalne zapełnienie.

Pozostałe przypadki: wzorzec pięciu pozycji mieści się na jednej stronie; siedem pozycji także na jednej po korekcie odstępów; trzydzieści pozycji na dwóch stronach; duże kwoty i ilości ułamkowe na jednej; pojedyncza pozycja z opisem dłuższym od strony na dwóch. Długi identyfikator bez spacji mieści się na jednej stronie po zmianie tytułu i nagłówków, przy zachowaniu wielkości tekstu danych.

Kontrola obejmuje zachowanie pełnego tekstu źródłowego przy fragmentacji oraz obecność fragmentów w wynikowym PDF-ie, poprawność stopek i numeracji, położenie licznika w osi X, marginesy oraz minimalne wielkości czcionek. Wszystkie strony wyeksportowano do PNG do kontroli wizualnej. Wybrane podziały sprawdzono także w pełnym powiększeniu.

## Weryfikacja i odtworzenie

```sh
node --test docs/wyceny/testy/pagination.test.mjs
node docs/wyceny/testy/adaptive-pdf.mjs /tmp/wyceny-paginacja-v2
python3 docs/wyceny/testy/audit-pdf.py /tmp/wyceny-paginacja-v2
```

Wymagania środowiska opisano w `README.md`. `fixtures.mjs` dostarcza wspólne dane poprzedniej i nowej serii testów. Pozytywne testy planera obejmują m.in. przenoszenie treści z pełnej pierwszej strony, zakaz podziału przy sumie, narzut nagłówków, zachowanie kolejności i wybór stylu. Sprawdzany jest także jawny błąd dla bloku, którego nie można zmieścić na stronie.

W tej sesji: 8/8 testów planera oraz 242/242 istniejących testów aplikacji (`npm test`) przeszło. Testy aplikacji wypisały ostrzeżenia `transform_index_html_unsupported` i `derived_inert`; nie spowodowały błędów testów.

Artefakty: `/Users/daniel/.codex/visualizations/2026/11/14/01a1da2e-90c6-77a2-8cda-d1a16c34923a/wyceny-paginacja-v2/`. `geometry.json` zawiera wybór stylu, zapełnienie stron, rozmiary czcionek i dane porównania; `fixtures.json` treść źródłową i oczekiwane fragmenty; `audit.json` wyniki kontroli PDF.

## Granice tej wersji

- Mechanizm jest sprawdzony w powyższej serii lokalnej. Integracja z rzeczywistymi danymi backendu i Gotenberg pozostaje osobnym krokiem; potrzebuje ponowienia tych samych testów w docelowym środowisku.
- Znana wada mapowania niektórych znaków w osadzonym foncie Inter pozostaje. Audyt normalizuje znane odpowiedniki przy porównywaniu tekstu. Poprawa osadzania fontu nadal jest wymagana przed wysyłaniem dokumentów klientom.
- Metryka i dane firmy są stałe w makiecie. Dowolnie długi nagłówek, ekstremalnie szerokie kwoty lub dowolnie długie dane stopki wymagają walidacji danych lub dodatkowych reguł. Obecna kontrola geometrii ma taki przypadek odrzucić zamiast dopuścić do nakładania tekstu.
- Próg 40% jest celem oceny układu, nie obietnicą dla dowolnych danych. Duży niepodzielny element może wymusić większą pustą przestrzeń; w aktualnym zestawie wszystkie wielostronicowe przypadki spełniają ten próg.
