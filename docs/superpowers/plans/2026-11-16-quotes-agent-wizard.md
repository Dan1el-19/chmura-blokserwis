# Moduł wycen: kreator i agent AI — zatwierdzony plan

## Cel i wiążące ustalenia
Repozytoria: chmura-blokserwis i UniSourceGO. Zachować Go/PostgreSQL/River/ConnectRPC/Gotenberg/R2. UI po polsku, desktop i mobile równorzędne. Obecny wygląd PDF, stopka, brak wprowadzenia. AI zmienia tylko nazwy, opisy i zakres po jawnej akceptacji; nigdy ilości/cen/VAT/sum.

## 1. Kreator
Lista wycen -> Nowa wycena -> import XLSX (ręcznie w opcjach zaawansowanych) -> podgląd i opcjonalna edycja danych, tytułu, klienta, daty -> pytanie Tak/Nie o AI -> opcjonalny agent z live aktywnością, streamingiem i prośbami o poprawki -> pełny PDF -> Edytuj/Zatwierdź -> podsumowanie i pobranie. Szkic powstaje po wyborze pliku lub ręcznego wejścia. Edycja: pola + czat, Zapisz i wróć do podglądu. Autosave jako ochrona. Zatwierdzić można tylko aktualną wersję obejrzanego PDF. Numer przy pierwszym zatwierdzeniu, rewizje ten sam numer. URL/historia i zapis etapu muszą umożliwiać wznowienie bez ponowienia AI.

## 2. Responsywność
Jedna wspólna rama i komponenty, główne działania przewidywalne. Od 320px bez overflow strony, listy pozycji na mobile, przyciski min44px. Pola i czat obok dopiero przy 1100px miejsca modułu, czat min340px; niżej przełącznik Dane wyceny/Asystent AI z zachowaniem stanu i scrolla. PDF fit-width, zoom w wewnętrznym obszarze. Klawiatura/safe area, focus, keyboard, reduced motion i aria-live bez odczytu tokenów. Nie wymuszać scrollowania podczas czytania historii.

## 3. Agent i research
Rzeczywista pętla modelu z narzędziami search_products (Brave) i read_source (HTML/PDF). AI wybiera zapytania, źródła, powtórzenia; preferuje producenta i dokładny model. HTML golang.org/x/net/html, PDF pdftotext w obrazie workera. Każdy zewnętrzny fakt opiera się na odczytanym źródle. Źródła to dane niezaufane. Brak wyników -> opis tylko na podstawie danych, ograniczenia w UI poza PDF. Nie przypisywać konkretnego modelu do ogólnej nazwy. Redagować nazwy zachowując oznaczenia modeli. Użyteczne opisy pozycji; zakres nie powtarza tabeli ani pustego Robocizna. Nie wymyślać prac.
Limity tury: 8 wywołań modelu research + final; 20 Brave,40 odczytów,180s research+65s final,270s job. 3 równoległe żądania,8s/5MiB/3 redirect na źródło. Publiczne IP sprawdzane przy DNS/połączeniu/redirect, bez prywatnych adresów. 36k znaków tekstów źródeł. Brak retry płatnego wywołania niepewnego. Trwała rozmowa i research ponownie używane w poprawkach. Zatrzymanie bez zastosowania partial.

## 4. Kontrakt/zapis/stream
Rozszerzyć quotes.proto addytywnie w obu repo. Propozycja każdego wiersza: line_index0/name/description + scope_sections. Dokładnie jeden rekord na linię. Rozmowa/message/cancel RPC; initial Generate i followup ten sam wykonawca. Zdarzenia typowane z sekwencją, cursor resume, zapis DB. Get/Watch zawierają partial tekst i wynik końcowy. Apply atomowy, idempotentny, expected_version, sprawdzenie quote/archived, stary klient nie zastosuje niepokazanych zmian. Jedna aktywna tura na wycenę. workflow stan osobny bez bump draftu. Wszystkie RPC autoryzowane jak istniejące. Migracje addytywne, czyszczenie oddzielnym narzędziem.

## 5. Numeracja/cutover
W/%03d/%04d, rok z Europe/Warsaw czasu publikacji, licznik atomowy roczny, ponad999 bez truncation. Użytkownik autoryzował usunięcie WSZYSTKICH wycen modułu i powiązanych danych/obiektów/kolejek, reset wszystkich liczników, od początku bieżącego roku bez hardcode; lokalnych PDF nie usuwać. Narzędzie dry-run/apply/resume i manifest, moduł zamknięty/worker wygaszony, usuwać tylko moduł nie inne tabele/bucket/queue. Uwzględnić orphan quotes/ objects i operacje bez quote id, FK cycle. Nie migracja startup. Zweryfikować pusty stan przed otwarciem. Cutover po testach i zgodnych deployach.

## 6. Odbiór
Klikalny prototyp desktop/mobile ścieżek zanim finalne UI. TDD backend/komponenty; realny Gotenberg i ograniczony live Brave/AI. Import/manual/noAI, poprawki czat, konflikty, reconnect/cancel, auth, źródła i limity/SSRF, numeracja rollover/concurrency, cutover idempotent/resume/nie dotyka innych modułów. Testy Go z PG/River, frontend pnpm check/lint/build/proto + komponenty + E2E desktop/mobile 320,390,768,1280,1440 Chromium/WebKit. Ręczna klawiatura mobile. Dane Drużynowej i monitoring. Sprawdzić parametry w źródłach, PDF treść/marginesy/paginacja/suma/stopka.
