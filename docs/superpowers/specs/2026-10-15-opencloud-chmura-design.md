# OpenCloud jako backend Chmury Blokserwis

Data: 2026-10-15  
Status: specyfikacja do przeglądu

## Cel

Uruchomić OpenCloud jako nowy backend plików Chmury Blokserwis, zachowując SvelteKit, logowanie Clerk i natywną aplikację Android. Nowa instancja ma działać obok obecnej chmury na osobnym hostname `cloud.unisource.pl`. Po sprawdzeniu funkcji, uprawnień, transferów i odtwarzania kopii można przenieść dane i przełączyć ruch. Wyceny, AI, generowanie dokumentów, wydania aplikacji oraz dane serwisowe pozostają początkowo w dotychczasowych usługach.

Głównym celem jest delegowanie funkcji plikowych do utrzymywanego projektu open source i ograniczenie logiki własnej do adapterów klientów i reguł produktu.

## Architektura

OpenCloud działa jako osobny, przypięty do wersji kontener na VM użytkownika. Używa pakietowych usług katalogu użytkowników i stanu zdarzeń, trwałej konfiguracji oraz lokalnego filesystemu POSIX. Reverse proxy udostępnia usługę pod `https://cloud.unisource.pl`. SvelteKit na Cloudflare Workers pozostaje interfejsem WWW i cienką warstwą produktu; bajty plików idą bezpośrednio do OpenCloud. OpenCloud nie jest przenoszony do Workers ani osadzany w UniSourceGO.

Clerk pozostaje źródłem uwierzytelnienia. Przed integracją klientów należy potwierdzić rzeczywisty przepływ tokenu do OpenCloud: najpierw konfigurację weryfikacji JWT, a jeżeli jej nie wystarczy — obsługiwany przez Clerk i OpenCloud OAuth/OIDC PKCE. Wymagane są jawne konta i katalog OpenCloud. Tożsamość wiążemy stabilnym `Clerk sub`, nigdy samym e-mailem. Brak ścieżki spełniającej te warunki bez forka lub dodatkowej platformy zatrzymuje wdrożenie.

## Dane, role i odpowiedzialności

- Każdy użytkownik ma osobisty Space. Obecne limity produktu pozostają domyślne: basic 5 GiB, plus 10 GiB, admin bez limitu aplikacyjnego, z zastrzeżeniem pojemności infrastruktury. Indywidualny limit administratora produktu ma pierwszeństwo.
- Main jest odrębnym Project Space, nie osobistym katalogiem administratora. Basic nie ma członkostwa, plus ma odczyt, admin zarządza i zapisuje. Uprawnienia wymusza OpenCloud, także przy bezpośrednim API.
- OpenCloud jest jedynym źródłem praw i metadanych dla plików w nowej chmurze. Nie duplikujemy katalogu plików w D1, Appwrite ani UniSourceGO. W domenie produktu dopuszczalne są wyłącznie powiązania do potrzebnych zasobów OpenCloud.
- OpenCloud obsługuje przestrzenie, pliki, foldery, quota, wersje, kosz, uprawnienia i linki. SvelteKit i Android dostarczają własne ekrany oraz wywołują wspólny kontrakt operacji plikowych.
- UniSource nadal obsługuje wyceny, AI i wydania aplikacji. Istniejący kod UniSource zawiera obsługę JWT Clerk i mapowanie tożsamości; zachowanie tego kontraktu należy potwierdzić w rzeczywistym przepływie. Brakującego kontraktu nie obchodzić lokalnym linkiem pakietu ani kontem administracyjnym.
- UniSourceGO/PowerSync nadal obsługuje dane serwisowe. Integracja plików nie dodaje synchronizacji chmury do istniejącego strumienia PowerSync.

## Transfery i storage

Pierwszym produkcyjnym driverem jest POSIX na VM. Próba używa TUS dostarczonego przez OpenCloud i `@uppy/tus` w WWW. Golden Retriever odzyskuje zapisany stan, lecz klient może wymagać ponownego wskazania pliku, gdy przeglądarka nie zachowała bajtów. Awaria VM pozostawia transfer oczekujący na wznowienie.

Android używa klienta TUS dla JVM/Android, trwałej kolejki w Room i planowania pracy przez WorkManager. Zachowuje dostęp do URI pliku tylko tak długo, jak pozwala Androidowy dostawca treści. Kolejka i cache są izolowane według konta.

R2 sprawdzamy później na osobnym bucketcie. Analizowana wersja OpenCloud przekazuje upload do S3 przez pełny plik tymczasowy na VM. Dlatego R2 nie eliminuje zależności od VM ani wymogu stagingu. Możliwość dwóch równoległych providerów sprawdzamy jako oddzielne, jawnie wybierane Spaces „Serwer” i „R2”; nie zakładamy automatycznego failoveru. Jeżeli konfiguracja dwóch providerów wymaga własnego drivera lub dodatkowego katalogu stanu, wersja podstawowa pozostaje na POSIX, a R2 może służyć do backupu.

## Interfejs produktu

Integracja klientów obejmuje listowanie, paginację, foldery, upload, pobieranie, podgląd, miniatury, zmianę nazwy, przenoszenie, kopiowanie, kosz i przywracanie, wersje pliku, publiczne linki oraz członkostwo Main. Adapter mapuje własne modele UI na API OpenCloud; nie implementuje ponownie praw, quota ani magazynu.

Wycenowe wersje dokumentów, historia AI, zadania generowania oraz wynikowe pliki pozostają odrębną domeną. Wersje OpenCloud nie zastępują historii wycen. Dotychczasowe publiczne linki i funkcje o ograniczeniach specyficznych dla starego magazynu pozostają dostępne podczas okresu przejściowego; przed importem każde zachowanie bez odpowiednika w OpenCloud musi otrzymać jawną decyzję migracyjną.

## Import, uruchomienie i odtworzenie

Nowa instancja zaczyna od fikcyjnych kont i danych. Import próbny używa OpenCloud API, manifestu mapującego właścicieli Appwrite na Clerk i OpenCloud oraz sum kontrolnych. Nie zapisuje plików bezpośrednio w wewnętrznym układzie storage. Nierozwiązany właściciel, błędne prawa lub niespójność sum blokują przełączenie.

Przełączenie wymaga zatrzymania starych zapisów, zakończenia uploadów, kopii starego stanu, finalnego importu i uzgodnienia manifestu. Po przełączeniu nowy system jest jedynym miejscem zapisu plików. Stary system pozostaje czasowo dostępny do odczytu dla istniejących odnośników i referencji.

Backup obejmuje konfigurację i sekrety, katalog tożsamości, uprawnienia, metadane, stan usług, indeksy wymagane do odtworzenia i pliki. Dla POSIX zachowuje atrybuty filesystemu. Kopia musi zostać odtworzona na pustej instancji. Aktualizacje obrazu testujemy na kopii danych; rollback DNS po przyjęciu nowych zapisów wymaga osobnego uzgodnienia danych.

## Etapy i kryteria akceptacji

1. **Uruchomienie próbne:** wersjonowany Compose, osobny hostname `cloud.unisource.pl`, POSIX, TLS, dwa fikcyjne konta. Plik pozostaje po restarcie usługi.
2. **Uwierzytelnienie i role:** Clerk JWT/OIDC, mapowanie `sub`, provisioning, blokada konta, Personal Space, Main i limity 5/10 GiB. Obcy issuer, audience, identyfikator pliku i użytkownik nieautoryzowany są odrzucani przez backend.
3. **WWW i TUS:** upload/pobieranie bez przesyłania bajtów przez Worker; wznowienie po utracie sieci, odświeżeniu i restarcie usługi; anulowanie, konflikt nazwy, quota i prawidłowa suma pobranego pliku. Wynik finalizacji ma być czytelny przez API.
4. **Bezpieczeństwo danych:** test kosza, wersji, linków i odebrania członkostwa; odtworzenie kopii na pustej instancji zachowuje konta, prawa i treść plików.
5. **Android:** wspólne dane z WWW, trwała kolejka po ubicu procesu, obsłużona utrata dostępu do URI, izolacja kont i zgodne operacje kosza.
6. **R2 (opcjonalne rozszerzenie):** upload, finalizacja, Range/download, kosz, wersje, awaria S3 i zużycie stagingu. Włączenie dopiero po udowodnieniu działania providera oraz osobnym odbiorze.
7. **Migracja:** odwracalny import próbny, zgodne liczniki/rozmiary/sumy, przypisani właściciele i prawa; krótkie zamrożenie zapisów oraz jedno źródło zapisu po przełączeniu.

Przełączenie produkcyjne nie następuje, jeżeli Clerk wymaga forka, prawa do plików nie są egzekwowane przez OpenCloud, dane nie przechodzą kontroli integralności albo odtworzenie kopii nie zostało wykazane.

## Założenia i poza zakresem

- Repozytorium aplikacji pozostaje `/Users/daniel/Projects/chmura-blokserwis`, branch `codex/opencloud-evaluation`. Repozytoria UniSource i Android wymagają odrębnych zmian w ich własnym zakresie.
- Podstawowy wariant wymaga VM i akceptuje jej okresową niedostępność. R2 nie stanowi automatycznego trybu awaryjnego.
- Podstawowe funkcje używają darmowego kodu OpenCloud oraz istniejących bezpłatnych planów usług; przed wdrożeniem sprawdzamy aktualne limity Clerk, Cloudflare i VM.
- Poza zakresem są forki OpenCloud/Reva, Kubernetes, HA, Collabora, indeksowanie treści, migracja wycen, przepisanie AI/renderowania oraz stały dual-write.
- Źródłowy audyt techniczny: `docs/audits/2026-10-14-opencloud-fit-gap.md`.

## Źródła techniczne

- [OpenCloud 8.1.0](https://github.com/opencloud-eu/opencloud/releases/tag/v8.1.0)
- [External OIDC](https://docs.opencloud.eu/docs/admin/configuration/authentication-and-user-management/external-idp/)
- [Storage S3](https://docs.opencloud.eu/docs/admin/configuration/storage/storage-decomposeds3/)
- [Backup](https://docs.opencloud.eu/docs/admin/maintenance/backup/)
- [Uppy Tus](https://uppy.io/docs/tus/) i [Golden Retriever](https://uppy.io/docs/golden-retriever/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
