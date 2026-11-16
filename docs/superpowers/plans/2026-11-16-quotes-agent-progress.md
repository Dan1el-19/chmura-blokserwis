# Postęp — 2026-11-16-quotes-agent-wizard

- Cała implementacja znajduje się w oryginalnych checkoutach Chmury oraz UniSourceGO na `main`, zgodnie z poleceniem użytkownika. Nie wykonano push ani wdrożenia.
- Zachowano istniejące nieśledzone pliki UniSourceGO. Produkcyjne dane wycen pozostają nietknięte.
- Kreator: import/manual, podgląd danych, decyzja AI, agent z propozycjami i czatem, PDF/edycja, zatwierdzenie/podsumowanie. Responsive desktop/mobile, render PDF jako warunek publikacji.
- Backend: trwała pętla researchu Brave/read_source, streaming i wznowienie zdarzeń, rozmowa i kontekst niezastosowanych propozycji, atomowa akceptacja zmian tekstu, niezależny workflow CAS, anulowanie, numeracja W/001/rok Warszawa.
- Przegląd wykrył i poprawiono: ponowne użycie klucza tworzenia drugiej wyceny, utratę kontekstu niezastosowanej propozycji, odrzucanie parametrów jawnie podanych przez użytkownika oraz brak odzyskania wersji workflow po utracie odpowiedzi. Testy regresji obejmują te scenariusze.
- Zielone bramki: 271 testów frontendowych; check 0 błędów/0 ostrzeżeń; lint; build; Protobuf lint/format/codegen i zgodność z backendem; go test ./...; go vet quotes/cutover.
- 16/16 testów przeglądarkowych Chromium/WebKit: 320–1440px, PDF.js, zoom/historia, agent/poprawka/akceptacja/edytor/publikacja desktop/mobile.
- 6/6 testów połączonych: realne Go/PostgreSQL/River/Gotenberg, XLSX/manual, AI/noAI, desktop/mobile, trwała poprawka w rozmowie po odświeżeniu, dwie rewizje/pobieranie. Ten sam końcowy przebieg: 16/16 dokumentów, współbieżna numeracja i cutover PASS (146,73 s). Poprawiono wygaszenie zastępczego workera w teście cutoveru; kontrola odmowy przy aktywnych jobach pozostała bez zmian.
- Live model + Brave + odczyt producenta TP-Link TL-SG105: PASS, źródło przypisane do opisu, streaming tekstu, brak zmian cen/ilości i bez wymyślonego zakresu. Hikvision: poprawny fallback przy braku czytelnego źródła.
- Świadome granice odbioru: sesja Clerk kontrolowana testowo; magazyn obiektów w połączonym teście izolowany w pamięci. Produkcyjny Clerk/R2 i wdrożenie nie są potwierdzone tymi testami. Gotenberg wykorzystano przez SSH, Brave/model z aktualnej konfiguracji (realne płatne wywołania).
- Cutover produkcyjny dopiero po zgodnych wdrożeniach i odbiorze. Zgoda użytkownika na usunięcie była udzielona; narzędzie nie zostało uruchomione na produkcji.

Szczegóły uruchamiania: [odbiór E2E](../../wyceny/e2e-acceptance.md).

- Rzeczywisty Poppler odczytał wygenerowany PDF (TestAgentPDFConverterAcceptance PASS). Wszystkie 16 PDF A4 zachowują nazwy, opisy i prawidłowe sumy; obejrzano przykładową stronę pierwszą i ostatnią dokumentu wielostronicowego.
