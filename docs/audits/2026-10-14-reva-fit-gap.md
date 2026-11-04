# Reva: mapa dopasowania do Chmury Blokserwis

Data: 2026-10-14. Dokument rozpoznania, nie zatwierdzona specyfikacja wdrożenia.

## Cel i granice

- Darmowy kod uruchamiany na własnej VM; bez wymaganych funkcji schowanych w płatnej edycji.
- Zachowanie własnego SvelteKit oraz natywnego interfejsu Android/Jetpack Compose.
- Wspólna instancja Clerk; ograniczenie własnej logiki infrastrukturalnej.
- Stara chmura pozostaje aktywna podczas testowania nowej. Mały prywatny ruch pozwala na końcowe wstrzymanie zapisów i import zamiast ciągłej replikacji.
- Rozpatrywane magazyny: lokalny dysk VM i R2. Wybór dwóch magazynów jest wymaganiem do sprawdzenia, a nie potwierdzoną funkcją każdej dystrybucji Reva.
- UniSource odczytano jako materiał referencyjny; bez zmian, buildów, publikacji lub wdrożeń. Android i UniSourceGO nie były w tej turze audytowane.

## Podstawa i poziom dowodów

Przejrzano aktualny kod chmura-blokserwis, API v2 i SDK w lokalnym UniSource oraz kod cs3org/reva v3.13.2, commit `2ab6d62b64fa8b2ccedda047234cae3af186dde7`. Kopia do odczytu znajduje się w `/tmp/chmura-reva-audit-20261014`.

Potwierdzenie oznacza obecność konkretnej implementacji w kodzie. Nie uruchamiano serwera Reva, testów integracyjnych, Clerk, migratora ani klientów. Interfejs CS3 nie gwarantuje, że każdy driver implementuje każdą operację.

## Kluczowy wynik: trzeba wybrać konkretną linię Reva

Upstream v3.13.2 ładuje lokalny dysk/localhome, Ceph i EOS. Nie zawiera sterowników S3 ani s3ng. README wyjaśnia, że dawna linia edge/2.x rozwija się w zewnętrznych forkach. Historyczne changelogi o s3ng nie dowodzą obsługi S3 w obecnym v3.

W katalogach aktualnych forków `opencloud-eu/reva` i `owncloud/reva` znaleziono `s3ng`; OpenCloud ma również `decomposeds3`. Sprawdzono obecność katalogów, nie pełne działanie ani kompatybilność R2. Nie można bez testu przenieść oceny drivera local z upstream v3 na te forki.

Wniosek: najpierw wybór linii i test wymagań; nie pisać własnego drivera S3 jako pierwszego kroku. Dla obu magazynów należy rozpoznać fork, zamiast uznać upstream v3 za kompletny zamiennik.

## Mapa funkcji

| Obszar obecnego produktu | Reva upstream v3.13.2 | Pozostała praca / decyzja |
|---|---|---|
| Prywatne pliki i foldery | Driver localhome, metadane, operacje na zasobach | Mapowanie tożsamości, kontrakt klienta, test izolacji dwóch użytkowników |
| Lokalny dysk VM | Driver local/localhome | Trwały wolumen i backup całego stanu, nie tylko widocznych plików |
| R2 / S3 na VM | Brak odpowiedniego drivera w upstream v3 | Ocena gotowego forka i jego driverów; potwierdzenie obu magazynów |
| Upload z możliwością wznowienia | localfs implementuje tus oraz zapis stanu uploadu | Uppy Tus w WWW; osobny klient w Androidzie; test po restarcie usługi |
| Odzyskanie pliku po zamknięciu strony | Odpowiedzialność klienta | Golden Retriever i ponowne wskazanie pliku, gdy przeglądarka go utraci |
| Kosz i przywracanie | Implementacje localfs | Sprawdzenie właściciela, konfliktu nazwy i sprzątania; test wybranego forka |
| Wersje plików | Implementacje localfs | UI historii, zasady retencji i zużycia dysku; odróżnić od wersji wycen |
| Udostępnienia użytkownikom/grupom | Gateway i provider shares, grants localfs | Konfiguracja katalogu użytkowników/grup oraz test skuteczności praw |
| Publiczne linki z hasłem i wygaśnięciem | Publicshare provider, trwały manager JSON | Dopasowanie UI i adresów; maksymalnej liczby pobrań/custom slug nie potwierdzono |
| Main | Możliwe złożenie ze wspólnego zasobu i praw | Nie jest gotowym odpowiednikiem naszego Main; localfs nie implementuje tworzenia/listowania/aktualizacji Storage Spaces |
| Indywidualna quota basic/plus/admin | GetQuota localfs odczytuje pojemność i użycie filesystemu | To nie rezerwowanie quota użytkownika. Wymaga innego gotowego drivera lub dodatkowego mechanizmu |
| Podgląd/odtwarzanie dużych plików | Pobieranie; localfs odrzuca żądania zakresów w Download | Sprawdzić rzeczywisty HTTP Range wybranego stacku, wideo i wznowienie pobierania |
| ZIP folderu / pobieranie wielu plików | Usługa archiver obsługuje ZIP/TAR z limitami konfiguracji | Wystawienie funkcji w klientach; test wydajności i praw |
| Clerk | Manager OIDC, mapowanie sub na użytkownika | Potwierdzenie discovery/JWKS/claims, polityki aud/azp i trwałego user providera |
| Role produktu i limit miejsca | Nie odwzorowują się automatycznie | Ustalenie jednej macierzy praw; usunięcie zależności od etykiet Appwrite |
| Zarządzanie kontami | User/group provider | Reva nie zastępuje Clerk Dashboard ani pełnego panelu produktu |
| Wyceny, numeracja, kwoty, akceptacja | Poza domeną Reva | Zachować istniejącą logikę; zapisywać wygenerowane pliki do silnika chmury |
| AI, XLSX, PDF/DOCX | Poza domeną Reva | Zachować biblioteki i zaplanować wykonanie zadań poza ograniczeniem Workers CPU |
| Wydania aplikacji / podpisane manifesty | Poza domeną Reva | Pozostawić osobny kontrakt release; silnik może przechowywać artefakty |
| Dane serwisowe i PowerSync | Poza domeną Reva | Pozostają w UniSourceGO; nie wdrażać drugiej synchronizacji tych samych danych |
| Aktualizacja UI na żywo | Gateway events może używać NATS | Nie dodawać infrastruktury od razu; odświeżanie na wejściu/po mutacji wystarczy dla pierwszego etapu |
| Backup, monitoring, sprzątanie | Konfiguracja usług + stan storage | Zaplanować trwałość metadata, grants, kosza, wersji, shares i tożsamości |

Obecna chmura zwraca 410 dla udostępniania folderów, ZIP folderu oraz tworzenia folderów Main. Reva może pozwolić odzyskać część tych możliwości, ale nie należy opisywać ich jako migracji już działających funkcji.

## Clerk: konkretny kontrakt do próby

Manager OIDC upstream korzysta z go-oidc i weryfikuje podpis oraz issuer; domyślnie używa `sub`, po czym odpytuje user providera przez claim `username`. Nie tworzy w ten sposób automatycznie pełnego katalogu użytkowników Clerk. Kod ustawia `SkipClientIDCheck: true`; zgodność z polityką audience/authorized parties naszego produktu musi być ustalona osobno, najlepiej z użyciem oficjalnej biblioteki Clerk w warstwie integracji.

Minimalna próba: dwie fikcyjne tożsamości, trwałe mapowanie Clerk sub, autoryzacja w WWW i Androidzie, wygaśnięcie tokenu, odrzucenie nieprawidłowego issuer oraz brak dostępu do cudzych zasobów. Nie mapować właścicieli po zmiennym adresie email.

## Docelowy podział do konsultacji

- Reva jako osobny proces/usługa na VM i właściciel domeny plików.
- Cienkie API produktu w Go: weryfikacja Clerk, mapowanie użytkownika i praw produktu, wygodne operacje dla klientów. Nie duplikować całej domeny plików w PostgreSQL/D1.
- SvelteKit i Android z jednym ustalonym kontraktem; nie zakładać, że istniejący TypeScript SDK działa w Kotlinie.
- WebDAV/gRPC to dodatkowe interfejsy integracji. Wieloplatformowy protokół nie jest gotowym ekranem ani automatyczną synchronizacją offline.
- Wyceny i release pozostają niezależnymi domenami. Ewentualne przeniesienie ich backendu wymaga osobnej decyzji.
- Bez kierowania dużych uploadów przez SvelteKit/Workers; klient wysyła dane do endpointu transferowego wybranego silnika.

Jeżeli wybrany silnik używa tus, wcześniejsza propozycja jednolitego Uppy S3 zostaje zmieniona: Uppy Tus dla endpointu Reva, ewentualnie Uppy S3 dla bezpośredniego R2. Nie tworzyć dwóch niezależnych źródeł metadanych tylko dla zachowania obu pluginów.

## Równoległe uruchomienie i przełączenie

1. Rozpoznać upstream/fork i domknąć luki dotyczące R2, quota, Main oraz Clerk.
2. Uruchomić izolowaną próbę z lokalnym storage i fikcyjnymi danymi; nowy hostname/port i osobne wolumeny.
3. Testować WWW i Android: listowanie, upload, wznowienie, pobieranie, foldery, kosz i shares. Żaden klient nie zapisuje testowych operacji do starej chmury.
4. Wykonać próbny import kopii: właściciele, struktura folderów, pliki i checksumy. Linki można wygenerować ponownie, jeśli użytkownik wybierze brak kompatybilności; nie usuwać ich bez tej decyzji.
5. Po akceptacji: backup starego stanu, krótkie zamrożenie zapisów, końcowy import i porównanie manifestów. Jeden aktywny system zapisu po przełączeniu.
6. Zachować starą chmurę do odczytu przez ustalony czas. Po nowych zapisach w nowej chmurze sam powrót DNS nie jest pełnym rollbackiem; trzeba odtworzyć również te zmiany.

Nie potrzeba stałego dual-write ani ciągłej replikacji dla zadeklarowanego prywatnego ruchu.

## Kryterium decyzji

Warto kontynuować, gdy gotowy wariant Reva obsługuje uzgodniony minimalny zakres bez własnego forka i dużego drivera storage/auth. Jeśli musimy sami dopisać S3, quota, wspólne zasoby i katalog użytkowników, korzyść utrzymywania mniejszej ilości własnego kodu nie jest potwierdzona.

## Źródła

- https://github.com/cs3org/reva/tree/v3.13.2
- https://github.com/cs3org/reva/blob/v3.13.2/README.md
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/storage/fs/loader/loader.go
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/storage/utils/localfs/localfs.go
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/storage/utils/localfs/localfs_unix.go
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/storage/utils/localfs/upload.go
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/auth/manager/oidc/oidc.go
- https://github.com/cs3org/reva/blob/v3.13.2/pkg/publicshare/manager/json/json.go
- https://github.com/cs3org/reva/blob/v3.13.2/internal/http/services/archiver/handler.go
- https://github.com/opencloud-eu/reva/tree/main/pkg/storage/fs
- https://github.com/owncloud/reva/tree/main/pkg/storage/fs
- Lokalne: src/lib/server/unisource.ts, src/lib/modules/upload.svelte.ts, src/routes/main/+page.server.ts, src/routes/api/shares/+server.ts, src/routes/api/folders/[folderId]/download/+server.ts.
