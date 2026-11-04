# OpenCloud jako backend Chmury Blokserwis — analiza dopasowania

Data: 2026-10-14. Rozpoznanie architektury do konsultacji, nie zatwierdzona specyfikacja wdrożenia.

## Werdykt

OpenCloud jest lepiej dopasowany niż sam upstream Reva do zastąpienia domeny plików: dostarcza Spaces, quota, katalog użytkowników/grup, publiczne linki, kosz, wersje i API. Dla prywatnego projektu z własnym WWW i Androidem warto przeprowadzić izolowaną próbę. Nie zastępuje całego UniSource ani backendu wycen.

Najważniejszy kompromis: domyślny sterownik S3 w sprawdzonej wersji przyjmuje cały plik na dysk VM, następnie wysyła go do S3. Nie zachowuje obecnej drogi klient → R2. Drugi kompromis: Clerk pozostaje źródłem logowania, lecz OpenCloud wymaga również własnego katalogu użytkowników i grup. Trzeci: obsługa lokalnego storage i S3 nie oznacza gotowego automatycznego fallbacku między nimi.

Rekomendacja warunkowa: osobny OpenCloud na VM, jedno źródło praw i metadanych plików, istniejący SvelteKit i natywny Compose, Clerk przez konfigurację JWT/OIDC, jeden storage użytkowy na początek. Jeśli wymaganiem koniecznym jest bezpośredni R2 niezależny od VM, ta wersja OpenCloud nie jest gotowym zamiennikiem.

## Zakres i dowody

- Kod serwera: tag `v8.1.0`, commit `8e5143088525a995fd4974810cce7eedbf2a3cdb`; publiczne GitHub Releases wskazało ten tag jako najnowsze wydanie, publikacja 2026-10-05.
- Kopia do analizy: `/tmp/chmura-opencloud-audit-20261014`, detached HEAD. Zależność vendored Reva: `github.com/opencloud-eu/reva/v2 v2.51.0`; analizowano kod faktycznie dostarczony z OpenCloud, nie inny fork.
- Dokumentacja administracyjna pokazuje wersję 7.2; nie traktowano jej jako dowodu identycznego zachowania 8.1.0. Rozbieżności weryfikowano w kodzie.
- Odczytano aktualny frontend, route handlers i moduł uploadu w chmura-blokserwis. UniSource, HEAD `45ae0a7`, był wyłącznie materiałem referencyjnym do odczytu.
- Nie uruchamiano OpenCloud, testów E2E, prawdziwego Clerk, R2 ani migracji. Nie badano aktualnej VM, kosztów jej ruchu lub wolnego dysku. Obecność implementacji i testów upstream nie oznacza działania integracji naszego produktu.
- Nie zmieniano backendu UniSource, Androida, UniSourceGO, produkcji ani konfiguracji kont. Jedynym nowym plikiem projektu jest ten raport.

## Co właściwie wdrażamy

To backend usługowy w Go, korzystający z własnego forka Reva, LibreGraph i NATS. Może uruchamiać usługi w jednym nadzorowanym procesie (`opencloud server`) lub osobno. Nie jest małą biblioteką wstawianą do Hono. Nie proponuję importować jego całego runtime do procesu UniSourceGO: osobny kontener daje niezależne aktualizacje i konfigurację.

Własny frontend może używać publicznego HTTP API. Dostarczony interfejs Web nie musi być interfejsem naszego produktu, ale usług `web`, `frontend` i `proxy` nie można usuwać tylko po nazwie: trzeba sprawdzić routing, capabilities, URL-e publicznych linków i discovery. Domyślny pakiet ma wiele usług, nie trzeba rozdzielać ich na kilkadziesiąt kontenerów. Katalog `idm` i NATS mogą działać w pakiecie. Dodatkowy Keycloak nie jest wymagany wyłącznie dlatego, że potrzebujemy zewnętrznego OIDC.

Nie wymaga zewnętrznego PostgreSQL/MySQL dla podstawowej domeny plików. Nie znaczy to braku trwałego stanu: metadata, xattrs, pliki indeksów, shares, konfiguracja tożsamości i stan NATS wymagają wolumenów i backupu.

## Mapa całego produktu

| Wymaganie / obecny moduł | Co dostarcza OpenCloud | Co pozostaje po naszej stronie |
|---|---|---|
| Prywatne pliki i foldery | Personal Space, zasoby, operacje plikowe, backendowe prawa | Mapowanie kont i ekrany; test izolacji dwóch osób |
| Main | Project Space z członkostwem i quota | Ustalenie członków, ról odczytu/zapisu i zarządców |
| Foldery w Main | Normalna struktura zasobów Space | Integracja UI; obecnie tworzenie folderów Main zwraca 410 |
| Nazwy, przenoszenie, kopiowanie | API plików i WebDAV | UI konfliktów, obsługa błędów, koszt kopiowania między providerami |
| Quota | Limity Spaces, w tym personal; backendowe sprawdzanie | Polityka basic/plus/admin i test równoległych uploadów |
| Dysk lokalny VM | `posix`, dodatkowo `decomposed` | Trwały POSIX filesystem, xattrs, prawa i miejsce na staging |
| R2 / własne S3 | `decomposeds3` i konfigurowalny endpoint S3 | Rzeczywisty test R2; osobny bucket; miejsce na tymczasowy pełny plik |
| Dwa magazyny jednocześnie | Rejestr providerów i architektura Spaces | Osobne instancje storage-users, ID/endpointy/routing; brak potwierdzonej prostej konfiguracji naszego wariantu |
| Automatyczne przejście VM → R2 przy awarii | Nie dostarcza takiego gotowego fallbacku | Dodatkowy system zapisu zwiększa złożoność i ryzyko duplikacji |
| Wznawianie uploadu | TUS, sesje serwerowe, offset i transferowe URL-e | Uppy Tus i trwała kolejka klienta; test po restartach |
| Odzyskanie po zamknięciu strony | Nie odzyskuje lokalnych bajtów przeglądarki | Golden Retriever, czasem ponowne wskazanie pliku |
| Android upload w tle | Wspólny protokół transferu | Biblioteka tus, trwałe URI/stan, mechanizmy Androida do pracy w tle |
| Kosz i przywracanie | Backendowe implementacje kosza | Ekrany i polityka retencji; test konfliktów przy odtworzeniu |
| Wersje plików | Lista wersji i przywracanie | UI i retencja; wersje plików nie są wersjami dokumentu wyceny |
| Shares do użytkownika/grupy | Backendowe udostępnienia i uprawnienia | Dostępne grupy, zapraszanie i prezentacja praw |
| Link publiczny | Hasło, wygaśnięcie i prawa linku | Nasza strona linku, URL i obsługa błędów; limitu liczby pobrań nie potwierdzono |
| Foldery udostępniane | Mechanizmy shares zasobów/folderów | Funkcja nowa względem route zwracającego obecnie 410 |
| ZIP folderu / wielu plików | Archiver | Limity, wywołanie przez właściwe ID; znane odstępstwa dla archive-by-path |
| Podglądy | Thumbnails i pobieranie | UI; test MIME, Range/seek, uprawnień miniatur i aktualizacji po nadpisaniu |
| Wyszukiwanie | Search service, opcjonalne indeksowanie treści | Test zakresu praw; Tika/ciężkie indeksowanie są dodatkowym kosztem |
| Aktualizacje na żywo | SSE i zdarzenia | Subskrypcje, reconnect, odświeżenie po przerwie; na start zwykły refresh wystarczy |
| Clerk | Konfigurowalne OIDC/JWKS/JWT i provisioning | Potwierdzić rzeczywisty token, issuer/discovery, audience, mapowanie sub i cykl życia kont |
| Panel admina produktu | API users/groups/Spaces/quota | Własny UI oraz podział odpowiedzialności Clerk/OpenCloud |
| Reset haseł | Lokalny IDM ma własne mechanizmy | Przy Clerk hasła zmienia Clerk; nie powielać admin endpointu Appwrite |
| Wyceny: pozycje, kwoty, numeracja, akceptacja | Poza zakresem silnika | Obecna domena wycen i jej baza pozostają |
| AI, XLSX, PDF/DOCX | Może przechować pliki wynikowe | Obecne usługi AI/renderery/parser; Office nie zastępuje renderera wycen |
| Historia wycen / konflikty / idempotencja AI | Wersje plików nie zastępują tego modelu | Zachować obecny kontrakt i trwałe rekordy zadań |
| Wydania aplikacji | Magazyn może przechować artefakt | Podpisy, manifesty i polityka publikacji pozostają osobną domeną |
| Dane serwisowe i PowerSync | Poza zakresem | UniSourceGO/PowerSync; bez drugiej synchronizacji tej samej domeny |
| Offline metadanych chmury | API i protokoły umożliwiają integrację | Cache, odtwarzanie operacji, konflikty i UI klienta; brak automatycznej integracji z PowerSync |

## Clerk — dwie możliwe ścieżki

### A. Obecna sesja Clerk i dedykowany JWT dla OpenCloud

Najpierw warto sprawdzić tę ścieżkę, ponieważ zachowuje obecne logowanie w natywnej aplikacji. Backend OpenCloud może weryfikować JWT przez discovery/JWKS i pomijać UserInfo (`PROXY_OIDC_SKIP_USER_INFO=true`), biorąc claims z tokenu. Od 8.1.0 ma `PROXY_OIDC_AUDIENCES`; jego brak wyłącza sprawdzanie audience. Konfiguracja musi jawnie ustalić issuer, audience, podpis, czas ważności i wymagane claims.

Kandydat mapowania: `sub` Clerk → username katalogu OpenCloud, albo trwały osobny identyfikator zapisany podczas provisioningu. Weryfikacja username=Clerk sub jest wymagana, nie stwierdzono jej działania. Nie mapować tożsamości po email. Nie wolno utożsamiać krótkiego tokenu sesji Clerk, ID tokenu OIDC i OAuth access tokenu.

Katalog użytkowników pozostaje: wbudowany `idm` albo inny wspierany katalog LDAP. Automatyczny provisioning wymaga writable LDAP; claims username/email/displayName mają konfigurację. Zmiana roli, zablokowanie konta i usunięcie użytkownika wymagają osobnej spójnej polityki. Nie ma potwierdzonej automatycznej synchronizacji wszystkich zmian Clerk.

### B. Clerk jako dostawca OAuth/OIDC

Aktualna oficjalna dokumentacja Clerk opisuje public clients, Authorization Code + PKCE, scopes `openid/profile/email/offline_access`, OAuth JWT oraz discovery. To wzmacnia wykonalność integracji i koryguje wcześniejsze traktowanie Clerk jako jedynie niepewnego dostawcy OIDC.

OpenCloud oczekuje discovery `/.well-known/openid-configuration`. Przeczytana dokumentacja Clerk pokazuje również `/.well-known/oauth-authorization-server`; koniecznie sprawdzić właściwy endpoint rzeczywistej instancji. Claims i audience muszą odpowiadać konkretnemu tokenowi. Nie zakładać, że aplikacja natywna zalogowana Clerk SDK już posiada odpowiedni OAuth access token.

Stałe client IDs z dokumentacji OpenCloud dotyczą gotowych klientów OpenCloud; własny SvelteKit/Android może mieć własne aplikacje OAuth. Włączenie dodatkowego OAuth może wymagać obsługi callbacku i refresh tokenów. W pierwszej próbie preferuję A, jeśli bez zmian silnika spełni weryfikację tokenów. Plan/limity konkretnych funkcji Clerk wymagają sprawdzenia w naszym koncie; nie są dowodem blokady darmowego OpenCloud.

## Role, Main i quota

`basic` i `plus` są rolami produktu. Nie trzeba tworzyć dwóch globalnych ról administratora silnika. Obaj mogą być zwykłymi użytkownikami OpenCloud z inną quota personal Space; `plus` dodatkowo otrzymuje członkostwo grupy/Space Main. Uprawnienia dostępu do Main należy egzekwować w OpenCloud, nie wyłącznie przez ukrycie zakładki w SvelteKit.

Proponowane odwzorowanie: personal Space na użytkownika i jeden Project Space Main, utrzymywany niezależnie od prywatnego katalogu administratora. Role Space: czytelnik, osoba modyfikująca, zarządca według wymaganej polityki. Nie zakładać automatycznego dostępu do zawartości tylko z globalnej roli admin: zarządzanie przestrzenią i czytanie jej danych są odrębnymi uprawnieniami.

Quota istnieje w kodzie, ale nie potwierdzono równoważności z naszym obecnym mechanizmem rezerwacji aktywnych uploadów. W analizowanej funkcji kontrola odwołuje się do użycia drzewa i wolnego dysku. Trzeba zbadać dwa jednoczesne uploady przekraczające limit, nadpisanie pliku, wersje, kosz i upload z odroczonym rozmiarem. Quota użytkownika nie jest równa całkowitemu kosztowi dysku/bucketu, który obejmuje stare wersje i staging.

## Storage i transfer danych

### Lokalny dysk

`posix` to obecny domyślny driver. Wymaga poprawnych extended attributes i POSIX filesystemu; backup samej widocznej struktury plików jest niepełny. Trybu filesystem watcher/assimilation nie włączać bez potrzeby. Zewnętrzne modyfikacje katalogów podczas działania mają ograniczenia i potrafią utrudnić prawidłowe liczenie rozmiaru/uprawnień.

Dla samego dysku lokalnego nie potrzebujemy stawiać MinIO tylko po to, żeby udawać S3. Dodaje proces, politykę bucketu i drugą konfigurację zamiast wykorzystać gotowy driver.

### S3/R2

`decomposeds3`: metadata zostają na filesystemie VM, bloby trafiają do S3. Implementacja używa biblioteki klienta MinIO — nie oznacza wymagania uruchomienia serwera MinIO przed R2.

Potwierdzona ścieżka w kodzie: TUS WriteChunk dopisuje do lokalnego pliku; Finalize wywołuje WriteBlob; S3 blobstore otwiera plik (`os.Open`) i używa PutObject. Wynik: klient → VM/staging → R2. Pobieranie blobów również wykonuje GetObject przez serwer; nie znaleziono w tej ścieżce gotowego publicznego presign-R2 dla klienta.

Konsekwencje: potrzeba miejsca przynajmniej na pełne równoczesne uploady plus margines/postprocessing; dodatkowe I/O i czas finalizacji; możliwe koszty transferu VM do R2. Awaria VM blokuje domenę chmury mimo zachowania blobów w R2. Ukończenie wysyłania bajtów klienta nie może być utożsamione z gotowym, dostępnym plikiem.

Nie podłączać obecnego bucketu jako gotowego drzewa plików: OpenCloud ma swój model ID/blobów/metadata. Potrzebny import przez jego API i osobny testowy bucket. Dokumentacja wprost ostrzega o braku automatycznej migracji między backendami storage.

### Lokalny dysk i R2 jednocześnie

Kod gateway ma konfigurowalny rejestr providerów, lecz pojedyncza usługa storage-users wybiera jeden driver. Dwa user-storage wymagają sprawdzenia konfiguracji dwóch providerów, odrębnych mount IDs, nazw usług, portów, transfer endpoints, roots i routingu tworzenia Spaces. Jest to możliwość architektury, nie zweryfikowany gotowy przepis dla naszego projektu.

Najprostszy kierunek po próbie: dwa jawne miejsca docelowe/Spaces („Serwer”, „R2”), a nie automatyczny ruch każdego pliku między magazynami. Przeniesienie między providerami trzeba traktować jako operację copy+verify+delete do czasu wykazania innych gwarancji; nie obiecywać atomowości.

Brak dostępności VM nie zostaje rozwiązany samym drugim bucketem. Bezpośredni awaryjny zapis Worker→R2 wymaga drugiego katalogu/stanu operacji i późniejszego importu do OpenCloud. To odtwarza część własnej logiki, którą użytkownik chce usunąć. Dla prywatnego projektu preferuję oczekiwanie w kolejce i wznowienie po powrocie VM.

## TUS, Uppy i odzyskiwanie

OpenCloud zawiera tusd przez Reva, więc osobny serwer tusd na początku jest zbędny. W WWW preferowany Uppy + `@uppy/tus` + Golden Retriever; aktualizacja Uppy i zmiana protokołu są osobnym zakresem implementacji.

Uppy Tus nie można podłączyć przez przypadkowe ustawienie endpointu Graph. Sprawdzony `CreateUploadSession` zwraca `UploadURL` dla protokołu simple oraz `CS3Protocols`; ma też uproszczony model względem Microsoft Graph. Trzeba uzyskać endpoint/token TUS z właściwej ścieżki WebDAV/CS3 i ustalić tworzenie, HEAD, PATCH oraz anulowanie. Nie zakładać zgodności pełnego Microsoft Graph upload SDK. Transferowy token w proxy ma w tym kodzie 24h ważności; TTL sesji storage i stan finalizacji wymagają odrębnych testów.

Golden Retriever przywraca stan Uppy i, gdy przeglądarka je zachowała, lokalne bajty. Service Worker nie utrzymuje dużych plików po restarcie całej przeglądarki. Czasem użytkownik musi ponownie wskazać plik; serwer nadal może pozwolić wykorzystać już przesłaną część. Potrzebne stabilne ID Uppy, stan powiązany z kontem, brak cancelAll przy zwykłym odmontowaniu widoku i poprawne czyszczenie po wylogowaniu.

W Androidzie frontend webowy ani Golden Retriever nie zastępują trwałej kolejki uploadu, uprawnień do URI, odtworzenia po ubiciu procesu i pracy w tle. Biblioteka TUS przejmuje protokół, mechanizmy Androida przejmują planowanie; ekran Compose i integracja stanów pozostają nasze. Nie analizowano jeszcze konkretnej biblioteki Kotlin/Java ani kodu Androida.

Jeśli transfer jest proxowany przez Cloudflare, limit rozmiaru pojedynczego requestu wymusza odpowiedni chunkSize; TUS nie znosi limitu HTTP. Darmowe Workers można zachować na frontend/cienkie API. Nie przeniesiemy runtime Go/NATS/POSIX OpenCloud do zwykłego Workers przez zmianę adaptera lub kompilację WASM.

## API i klienci

Graph/LibreGraph jest REST API, WebDAV obsługuje operacje plikowe, OCS/CS3 pokrywają pozostałe powierzchnie. Dostępne są Graph v1.0 i v1beta1, ale API jest inspirowane Microsoft Graph, nie jego pełnym zamiennikiem. Obsługa JSON w jednym miejscu nie oznacza identycznych kontraktów kosza, wersji i TUS.

Najmniejsza integracja: wspólny kontrakt operacji produktu, niewielkie adaptery HTTP i przekazywanie tokenu użytkownika. SvelteKit może wykonywać małe operacje serwerowo; transfer bajtów kierować na OpenCloud. Android może wywoływać publiczne API bez pośredniego przesyłania każdego pliku przez UniSourceGO. Cienki adapter w Go jest uzasadniony, gdy naprawdę upraszcza klientów; nie przepisywać w nim quota/shares/kosza.

OpenCloud powinien pozostać właścicielem plikowych praw i metadanych. Baza produktu przechowuje wyłącznie powiązania np. quotationId → driveId/itemId. Nie odtwarzać tabeli wszystkich plików w D1/PostgreSQL jako równoległego katalogu. Ustalić usuwanie/archiwizację powiązań i dostęp do wynikowych PDF po zmianie członkostwa.

Własny frontend oznacza także własne ekrany nowych możliwości (wersje, członkowie Spaces, publiczny link). Gotowe aplikacje OpenCloud mogą być opcjonalnym drugim klientem, ale nie dowodzą integracji natywnego Blokserwis.

## Darmowość i ograniczenia

Kod serwera jest Apache-2.0; Community Edition jest dostępna bez opłat i producent dopuszcza jej użycie produkcyjne. Nie znaleziono podstaw do uznania płatnej subskrypcji za wymóg podstawowych funkcji analizowanych w publicznym kodzie. Nie wynika z tego obietnica wszystkich funkcji każdej dystrybucji bez ograniczeń.

Producent sprzedaje osobno production-approved releases, LTS i wsparcie oraz prezentuje wybrane możliwości w wyższych planach. Tabela komercyjnych planów nie zawiera kolumny Community i sama nie jest dowodem blokady konkretnej implementacji open source. W zakresie plików/Spaces/quota/OIDC można oceniać publiczny kod. White-label/OEM, wsparcie, HA i dodatki wymagają odrębnej oceny, gdyby stały się potrzebne; własny frontend nie jest automatycznie tym samym co rebranding dostarczonego Web.

Nie ma kosztu licencji podstawowego serwera; pozostają koszty VM, dysku, backupu, S3 i transferu. Istnieją limity infrastruktury Cloudflare/Clerk oraz fizycznej pojemności. Nie proponuję płatnej edycji jako obejścia braków.

## Eksploatacja i niezawodność

Oficjalna dokumentacja podaje minimalnie 512 MB RAM / 1 rdzeń dla małego bare-metal wdrożenia. To nie jest pomiar naszego stacku z miniaturami, współbieżnymi uploadami i innymi usługami VM. Do próby planować budżet RAM/CPU/dysku i zmierzyć działanie; nie opierać doboru maszyny na minimum marketingowym.

Początek: jeden kontener OpenCloud, trwałe data/config, reverse proxy/TLS i osobny hostname. Użyć pakietowego IDM/NATS. Nie dokładać Kubernetes, zewnętrznego LDAP, Collabora, Tika, OCM ani zaawansowanych polityk przed potrzebą. Wyceny/AI/renderowanie utrzymywać osobno. Usuwanie usług z pakietu poprzedzić sprawdzeniem zależności.

Backup musi obejmować config/secrets, identities, shares/permissions, metadane, indeksy, stan NATS, kosz, wersje i bloby. POSIX backup zachowuje xattrs i uprawnienia. Dla S3 potrzebny spójny punkt czasowy metadata i bucketu; dokumentacja zaleca zatrzymanie instancji na spójny backup. Dla zadeklarowanego małego prywatnego ruchu krótkie okno jest prostsze niż projektowanie HA.

Odtworzenie sprawdzać na osobnej instancji: dwaj użytkownicy, Main, publiczny link z hasłem, aktualna i poprzednia wersja, kosz. Kopia bucketu bez katalogu/metadata nie wystarcza. Trzymać przypięty obraz/wersję, robić próbę upgrade na kopii stanu. Rollback obrazu nie gwarantuje cofnięcia migracji metadanych.

Monitorować: wolny staging/dysk, stuck uploads, błędy finalizacji S3, NATS, liczbę błędów API, czas listowania i transferu. Istnieją CLI do sesji uploadów i konserwacji; harmonogram purge/cleanup wymaga konfiguracji. Nie usuwać blobów regułą bucket lifecycle sprzeczną z referencjami OpenCloud.

## Znane problemy — stan odczytany 2026-10-14

- Issue #2757 „Update local upload to S3 storage system” jest otwarte. Zgłasza konieczność przechowywania całego uploadu na VM przed wysłaniem do S3; zachowanie potwierdzono niezależnie w kodzie 8.1.0.
- Issue #2864 o finalizacji plików ponad 30 GB przez TUS/posix jest zamknięte jako completed. To historyczny przypadek, nie dowód obecnego błędu 8.1.0. Uzasadnia test finalizacji największego planowanego pliku, nie tylko transferu do 100%.
- Issue #2907 o migracji członkostwa Spaces jest zamknięte jako completed. Podkreśla potrzebę kontroli praw/członków po upgrade.
- W repozytorium nadal są jawne expected-failures dla posix/decomposed: m.in. odpowiedź błędnego checksum TUS, wybrane quota PROPFIND i archive-by-path. Nie prowadzono pełnego security audytu ani uruchomienia tej listy; nie należy z niej wnioskować, że wszystkie podstawowe funkcje są zepsute. Testować wybrane operacje i właściwe ID.

## Ile własnego kodu można usunąć

Docelowo OpenCloud może przejąć custom CRUD plików/folderów, implementację shares/linków, kosz, wersje, liczenie użycia/quota dla Spaces oraz zarządzanie serwerowymi uploadami. Jeśli cały zapis przejdzie do niego, można wycofać Appwrite Storage i custom multipart R2 z domeny chmury oraz mechanizm przenoszenia R2→Appwrite. Nie usuwać tego przed migracją.

Pozostaną: integracja tożsamości i członkostwa, adaptery klientów, ekrany, lokalne cache/queue, import danych, wiązania dokumentów oraz domeny wycen/AI/releases. Dlatego korzyść jest duża w domenie plików; nie usuwa całego backendu produktu. Nie podaję procentu redukcji kodu bez projektu i pomiaru rzeczywistych usuwanych ścieżek.

## Próba kwalifikacyjna i kryteria odbioru

Nie jest to zatwierdzony plan implementacji. Kolejność minimalizuje inwestycję przed sprawdzeniem blokujących kontraktów.

1. Izolowany serwer 8.1.0, lokalny POSIX, fikcyjne dane, dwa konta. Potwierdzić publiczne API bez używania gotowego Web jako klienta produktu.
2. Prawdziwy kontrakt Clerk na testowej konfiguracji: discovery/JWKS, JWT audience, provisioning, refresh/expiry, obce issuer/audience, blokada konta. Warunek: bez własnego forka auth.
3. Personal Spaces + Main: basic/plus/admin, odczyt/zapis, odebranie członkostwa, backendowe odrzucenie cudzych IDs i URL-i. Sprawdzić miniatury/shares i dostęp po wygaśnięciu.
4. Upload TUS: mały i duży plik, zerwanie sieci, odświeżenie, restart przeglądarki, restart usługi, anulowanie, wygasła sesja, konflikt nazwy, checksum. Ukończenie oznacza odczyt z poprawnym hashem.
5. Quota: dwa równoległe uploady, nadpisanie, kosz/wersje, pełny staging. Sprawdzić, czy gotowe mechanizmy wystarczą bez własnego licznika rezerwacji.
6. R2 w osobnym bucketcie: upload, finalizacja, download/Range, kosz, restore/version, niedostępny S3, cleanup. Zmierzyć staging, transfer i finalizację. Lokalny PoC nie dowodzi R2.
7. Jeden przekrój WWW/Android na wspólnych danych: WWW dodaje, Android widzi/pobiera, Android usuwa, WWW widzi kosz. Osobna autoryzowana praca repo native jest potrzebna do wykonania zmian.
8. Odtworzenie pełnej kopii na pustej instancji, próbny upgrade i kontrola członkostwa/Main/linków.
9. Dopiero jeżeli dwa magazyny nadal są potrzebne: dwa providery i jawny wybór Space; sprawdzić routing, quota i copy między nimi. Nie uzależniać podstawowej oceny od rozbudowanego fallbacku.

Warunki przyjęcia: potrzebne funkcje są dostępne w darmowym publicznym kodzie, Clerk działa przez konfigurację/mały adapter, brak własnego drivera storage i drugiego katalogu plików, akceptacja zależności VM oraz staging. Warunki odrzucenia: wymóg bezpośredniego R2/niezależności od VM albo konieczność forkowania auth/quota/storage dla podstawowych funkcji.

## Migracja obok obecnej chmury

Stara chmura pozostaje aktywna, OpenCloud ma osobny hostname, wolumeny i bucket. Nowa instancja najpierw dostaje fikcyjne dane i kopię do próbnego importu. Bez dual-write. Import: mapowanie Appwrite owner ID → Clerk sub → OpenCloud user ID, foldery, pliki/Main, checksums, uprawnienia i ustalone linki. Nie przenosić bezrefleksyjnie `is_main_storage` jako prywatnego pliku administratora.

Na przełączenie: pełny backup starego stanu, krótkie zatrzymanie zapisów, finalny import, manifest liczby/rozmiarów/hashów i kontrola praw. Jeden aktywny system zapisów. Wyceny/releases przełączane oddzielnie, jeśli zmienimy magazyn ich wyników. Stary stan przez uzgodniony czas do odczytu. Po nowych zapisach w OpenCloud powrót samego URL/DNS nie odtwarza tych zmian w starej chmurze.

## Źródła i miejsca w kodzie

- [Serwer i licencja](https://github.com/opencloud-eu/opencloud/tree/v8.1.0), [wydanie 8.1.0](https://github.com/opencloud-eu/opencloud/releases/tag/v8.1.0).
- Kod w tagu: `go.mod`; `opencloud/pkg/command/server.go`; `pkg/config/config.go`; `services/proxy/pkg/config/config.go`; `pkg/oidc/client.go`; `services/proxy/pkg/middleware/oidc_auth.go`; `services/proxy/pkg/middleware/account_resolver.go`; `services/proxy/pkg/middleware/datagateway.go`.
- Storage/API: `services/storage-users/pkg/config/config.go`; `services/storage-users/pkg/revaconfig/config.go`; `services/gateway/pkg/revaconfig/config.go`; `services/graph/pkg/service/v0/service.go`; `services/graph/pkg/service/v0/driveitems.go`.
- Vendored Reva w tagu: `vendor/github.com/opencloud-eu/reva/v2/pkg/storage/fs/decomposeds3/blobstore/blobstore.go`; `pkg/storage/utils/decomposedfs/upload/upload.go`; `pkg/storage/utils/decomposedfs/upload.go`; `pkg/storage/pkg/decomposedfs/node/node.go`; `pkg/storage/fs/posix/tree/revisions.go`.
- [OIDC zewnętrzny](https://docs.opencloud.eu/docs/admin/configuration/authentication-and-user-management/external-idp/), [Clerk OAuth](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth), [Clerk session tokens](https://clerk.com/docs/guides/sessions/session-tokens), [Clerk pricing](https://clerk.com/pricing).
- [Spaces API](https://docs.opencloud.eu/docs/dev/server/apis/http/graph/spaces/), [Graph service](https://docs.opencloud.eu/docs/dev/server/services/graph/information/), [funkcje](https://docs.opencloud.eu/docs/admin/features/).
- [POSIX](https://docs.opencloud.eu/docs/admin/configuration/storage/storage-posix/), [S3](https://docs.opencloud.eu/docs/admin/configuration/storage/storage-decomposeds3/), [wymagania](https://docs.opencloud.eu/docs/admin/getting-started/requirements/).
- [Backup](https://docs.opencloud.eu/docs/admin/maintenance/backup/), [maintenance CLI](https://docs.opencloud.eu/docs/admin/maintenance/maintenance-commands/), [Community i komercyjne plany](https://opencloud.eu/en/subscription-support).
- [TUS w Uppy](https://uppy.io/docs/tus/), [Golden Retriever](https://uppy.io/docs/golden-retriever/), [migracje Uppy](https://uppy.io/docs/guides/migration-guides/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- [S3 staging #2757](https://github.com/opencloud-eu/opencloud/issues/2757), [duże pliki #2864](https://github.com/opencloud-eu/opencloud/issues/2864), [członkostwo #2907](https://github.com/opencloud-eu/opencloud/issues/2907).
- Bieżący produkt: `src/lib/server/unisource.ts`, `src/lib/server/roles.ts`, `src/lib/modules/upload.svelte.ts`, `src/routes/main/+page.server.ts`, route handlers `src/routes/api/`; referencyjnie UniSource `routes/v2/upload.ts`, `db/v1/storageMigrations.ts`, `services/quotations/`.
