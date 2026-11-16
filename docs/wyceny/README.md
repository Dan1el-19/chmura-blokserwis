# Wzorzec dokumentu wyceny

Głównym wzorcem wizualnym generatora jest [wzor-glowny.pdf](wzor-glowny.pdf), zaakceptowany 15 listopada 2026. To makieta na danych przykładowych, nie wynik obecnego generatora ani dokument do wysyłki klientowi.

## Układ i treść

- W nagłówku: logo po lewej, numer i data po prawej, wyrównane do wysokości logo; bez napisu „Wycena · przykład”. Tytuł może zajmować całą dostępną szerokość.
- Główny wariant pokazuje sekcję „Wycena”, sumę brutto, a poniżej sekcję „Zakres”. Nagłówki sekcji mają jasne tło i pomarańczowy akcent z lewej.
- Pozycje zawierają nazwę, opcjonalny krótki opis, ilość × cenę brutto i wartość brutto. Przy mnożniku nie pokazujemy jednostki; waluta pozostaje przy kwocie.
- Zakres zawiera rzeczowe, krótkie sekcje wynikające z danych wyceny. Nie dopisujemy parametrów, czynności, warunków, gwarancji ani terminów, które nie zostały podane. Nie powtarzamy opisów tylko po to, aby wypełnić przestrzeń.
- Stopka ma trzy części: po lewej nazwa spółki, wspólnicy i NIP; po prawej telefon, e-mail i strona internetowa w osobnych wierszach; numer strony wyśrodkowany w osi X, wyrównany w pionie do pierwszego wiersza stopki. Dane w makiecie pochodzą ze starszej wyceny i przed wdrożeniem wymagają potwierdzenia.

## Zachowanie dokumentów o różnej długości

Docelowy generator powinien obsłużyć krótkie i wielostronicowe wyceny bez przycinania i nakładania treści. Należy zachować czytelny rozmiar tekstu, sensownie dzielić pozycje i sekcje pomiędzy stronami oraz generować prawidłową numerację. Jednostronicowego dokumentu nie należy mechanicznie centrować w pionie, jeśli powoduje to duże puste przestrzenie; wariant główny jest punktem odniesienia dla proporcji i odstępów.

Wcześniej rozważano również układ „Zakres” i „Wycena” obok siebie oraz automatyczny wybór układu na podstawie rzeczywistej zawartości. Przy implementacji należy porównać takie zachowanie z głównym wzorcem i sprawdzić wynikowy PDF dla różnych długości treści; dotychczas nie zostało ono zaimplementowane.

Aktualne reguły opisuje [paginacja w wersji 2](testy/PAGINACJA.md): planowanie podziałów, ocena zapełnienia ostatniej strony oraz dobór odstępów i wielkości tytułu/nagłówków. Sprawdzono 16 przypadków treści. [Raport pierwszej serii](testy/README.md) zachowuje wcześniejsze wyniki. Mechanizm działa jako lokalny prototyp do integracji z generatorem.
