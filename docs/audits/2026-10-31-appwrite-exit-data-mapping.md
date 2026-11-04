# Odłączenie Appwrite: dane i migracja do R2

Data: 2026-10-31. Status: propozycja do projektu migracji, bez zmian produkcyjnych.

## Uzgodniony zakres

- Logowanie przez istniejącą produkcyjną aplikację Clerk UniSource na domenie blokserwis.pl.
- R2 jako jedyny docelowy magazyn plików. Bez RustFS w tej migracji.
- Wyłączenie Fast Upload, wyboru Appwrite i funkcji migracji między magazynami.
- Releases EOL: wyłączenie modułu, jego API, publikacji i synchronizacji konfiguracji.
- Jednorazowe przeniesienie istniejących plików z Appwrite do R2 jest osobną operacją od wyłączanych funkcji produktu.
- Brak kasowania historycznych wydań i danych źródłowych w ramach tej propozycji.

## Co zostało sprawdzone

Przegląd lokalnego kodu Chmury i referencyjnego repozytorium UniSource. UniSource pozostało tylko do odczytu. Nie sprawdzano zgodności jego lokalnej rewizji z wdrożeniem produkcyjnym.

Konektor Clerk potwierdził aplikację `UniSource ID`, `app_3HQWrVNh05FLAXZVhuUsbMjLQXe`, z istniejącą instancją produkcyjną `ins_3HZAwsjKhVXOEUqHZe097g7k49I`. Jej domeną jest `auth.blokserwis.pl`, Frontend API to `https://clerk.auth.blokserwis.pl`, a portal kont to `https://accounts.auth.blokserwis.pl`. Nie zmieniano konfiguracji ani kont. Sama obecność instancji nie potwierdza jeszcze konfiguracji Chmury, DNS ani uprawnień jej użytkowników.

Nie wykonano inwentaryzacji produkcyjnych D1, Appwrite Storage, baz Appwrite ani obiektów R2. Liczby plików, ich dostępność, pojemność, konflikty i kompletność migracji pozostają do sprawdzenia.

## Obecne źródła danych

| Dane | Źródło wskazane przez aktualny kod | Znaczenie dla migracji |
| --- | --- | --- |
| Pliki i ich położenie | UniSource APP_DB: `files`, `uploads` | Zachować identyfikatory; uzgodnić wszystkie operacyjne wskaźniki lokalizacji |
| Foldery i kosz | APP_DB: `folders`, pola kosza w `files` | Zachować hierarchię, właścicieli i stan kosza |
| Linki udostępniania | APP_DB: `share_links` | Zachować slugi, powiązania, hashe haseł, terminy i liczniki |
| Dostęp do usługi, role, limity | APP_DB: `service_users`, `services` oraz obecnie etykiety/profil Appwrite | Ustalić jedno źródło ról Chmury i usunąć odczyty Appwrite |
| Powiązanie kont | BLOKSERWIS_DB: `identities`, `identity_provider_links` | Wykorzystać istniejące powiązanie Clerk z właścicielem danych |
| Profile i logowanie | Appwrite; docelowo istniejący Clerk produkcyjny | Rozliczyć konta już przeniesione, brakujące i kolizje |
| Dawne metadane Chmury | Appwrite `main`: ślady `files`, `folders`, `file_shares`, `releases` | Inwentaryzacja i porównanie z D1, bez bezwarunkowego ponownego importu |
| Konfiguracja wydań | Appwrite `blokserwis-db/app_config` | Wycofać integrację Chmury; sprawdzić innych konsumentów przed usunięciem danych |
| Wyceny | APP_DB: `quotations` i tabele powiązane; artefakty wskazywane kluczami R2 | Zachować dane, autorów, wersje i artefakty; uwzględnić w testach tożsamości |

Nazwy pól o wyglądzie Appwrite w interfejsie nie dowodzą położenia danych. `src/lib/server/unisource-mappers.ts` przekształca odpowiedzi UniSource do dotychczasowego kształtu dokumentów, np. `$id`, `ownerId`, `parentFolderId`.

`scripts/init-db.ts` opisuje historyczny schemat Appwrite; nie jest dowodem obecnego stanu produkcji. Podobnie obecność helperów odczytujących Appwrite nie oznacza, że są nadal wywoływane przez produkt.

## Proponowane mapowanie tożsamości

Zachować dotychczasowy identyfikator właściciela jako stabilny identyfikator danych. Logowanie Clerk powinno rozwiązywać zweryfikowany `sub` do tego właściciela przez trwałe powiązanie tożsamości. Nie wykonywać masowego zastąpienia `user_id` identyfikatorami `user_...` Clerk.

Lokalny UniSource już realizuje wariant:

`Clerk sub -> identity_provider_links -> identities.appwrite_user_id -> service_users/files/folders/...`

Nazwa `appwrite_user_id` może pozostać przejściowo jako historyczna nazwa stabilnego identyfikatora. Sama nazwa nie wymaga działającego Appwrite. Docelowa zmiana nazwy i modelu identyfikatorów nie powinna być łączona z migracją binarnych plików bez konieczności.

Wymagany raport mapowania kont:

- konto Appwrite i historyczny właściciel danych;
- istniejąca tożsamość domenowa, jeśli jest;
- przypisany produkcyjny Clerk subject;
- dostęp do usługi Chmury, rola, własny limit oraz status konta;
- stan: już powiązane, do importu, konflikt, brak właściciela.

Istniejących kont Clerk nie tworzyć ponownie i nie nadpisywać im haseł. Sam zgodny email nie wystarcza do automatycznego połączenia: trzeba potwierdzić własność i brak sprzecznych powiązań. Nie zmieniać roli całej organizacji Clerk tylko po to, aby odwzorować lokalną rolę Chmury.

Repozytorium UniSource zawiera `apps/backend/scripts/migrate-appwrite-users-to-clerk.mjs`. To materiał do oceny, nie gotowa zgoda na uruchomienie. Skrypt oczekuje hasła lub digestu i odrzuca kolizje emaila z innym external ID; nie pokrywa samodzielnie wszystkich wariantów kont OAuth, brakujących hashy ani istniejących kont bez oczekiwanego external ID.

Import obsługiwanych hashy jest możliwą ścieżką dla brakujących kont; dostępność i format eksportu trzeba sprawdzić. Jeśli hasha nie ma lub format nie jest obsługiwany, potrzebna jest uzgodniona ścieżka odzyskania dostępu. Nie zbierać haseł użytkowników.

## Proponowane mapowanie plików

Dla pliku obecnego w D1:

| Element | Zasada |
| --- | --- |
| `files.id`, `upload_id` | Zachować; nie tworzyć ponownie pliku przez zwykły upload |
| `service_id`, `user_id`, `folder_id`, `is_main_storage` | Zachować izolację usługi, własność i położenie logiczne |
| Nazwa, MIME, rozmiar, kosz, daty | Zachować; rozbieżności ze źródłem raportować przed przełączeniem |
| `storage_destination` | Zmienić z `appwrite` na `r2` dopiero po weryfikacji kopii |
| `bucket`, `storage_key` | Zapisać zweryfikowane położenie docelowe |
| `uploads` i inne odczyty lokalizacji | Uzgodnić z `files`; część admin API pobiera lokalizację z rekordu uploadu |
| Linki udostępniania | Zachować `file_id` i slug; ponownie generowane adresy pobierania mają wskazywać R2 |

Appwrite file ID nie musi być równe `files.id`. W lokalnym backendzie jest odczytywane z ostatniego segmentu `storage_key`; manifest musi zawierać jawne source bucket i source file ID, potwierdzone w Storage.

Docelowe klucze R2 wyznaczać deterministycznie w przestrzeni danej usługi. Zapisywać je w manifeście przed kopiowaniem. Nie nadpisywać istniejącego obiektu o innym rozmiarze lub treści. Powtórzenie operacji ma korzystać ze zweryfikowanej kopii, a nie tworzyć kolejny rekord i naliczać limit drugi raz.

Bezpośrednie URL-e Appwrite przekazane poza aplikacją nie mogą zostać zachowane jako adresy R2. Zachowanie linków aplikacyjnych opartych o slugi jest osobnym, osiągalnym celem.

## Jak traktować stare bazy Appwrite

Najpierw porównać eksport z D1, uwzględniając zakres projektu, usługi i historyczne mapowania. Nie zakładać, że identyfikatory dokumentów Appwrite są równe identyfikatorom D1 ani że brak rekordu oznacza dane do odtworzenia — mógł zostać świadomie usunięty.

Każdy wpis klasyfikować jako: już odwzorowany w D1, unikalny rekord do importu, konflikt, historyczny/świadomie usunięty, poza zakresem albo osierocony. Dopasowanie tylko po nazwie lub rozmiarze nie jest wystarczające.

Jeżeli pozostaną faktyczne dane wyłącznie w Appwrite, proponowane odwzorowanie pól:

- folder: `$id -> legacy mapping -> folders.id`, `ownerId -> user_id`, `parentFolderId -> parent_id`;
- plik: `$id -> legacy mapping -> files.id`, `ownerId -> user_id`, `parentFolderId -> folder_id`, `name -> filename`, `mimeType -> mime_type`, potwierdzona lokalizacja obiektu;
- udostępnienie: legacy file ID przez mapę do `share_links.file_id`, token do slug tylko po sprawdzeniu kolizji i zgodności semantyki;
- czas: daty ISO do formatu docelowej tabeli, bez utraty strefy czasowej;
- uprawnienia Appwrite: ocenić i jawnie odwzorować na model docelowy; nie pomijać ACL tylko dlatego, że D1 ma właściciela.

Historyczny model udostępnień zawiera m.in. foldery, `autoDelete` i hashe haseł. Nie zakładać zgodności z linkami plikowymi D1. Niezgodne rekordy wymagają osobnego rozstrzygnięcia, a nie cichego spłaszczenia lub upublicznienia.

Releases i konfigurację wydań klasyfikować jako archiwum EOL. Nie importować ich ponownie jako aktywnego modułu.

## Jednorazowa migracja: proponowana kolejność

1. Potwierdzić wdrożoną wersję backendu i rzeczywiste zasoby produkcyjne. Lokalny `apps/backend/wrangler.jsonc` zawiera placeholder APP_DB/R2 i nie wystarcza do wskazania celu operacji.
2. Wykonać odczytową inwentaryzację D1, użytkowników, baz i Storage Appwrite oraz R2. Podać liczbę i rozmiar plików aktywnych i w koszu, rekordy bez obiektów i obiekty bez rekordów. Zakres Chmury oddzielić od innych usług.
3. Zapewnić możliwość odtworzenia baz i zapisać manifest mapowania. Nie logować sekretów, tokenów, hashy haseł ani pełnych danych kont w publicznym raporcie.
4. Wyłączyć nowe uploady Appwrite, Fast Upload i planowanie starych migracji R2 -> Appwrite dla Chmury. Zatrzymać i rozliczyć już uruchomione zadania oraz cleanup źródeł; samo ukrycie przycisku lub ustawienie rekomendacji R2 nie jest wystarczające.
5. Powiązać konta z istniejącym Clerk i przygotować backend/admin do działania bez wywołań Appwrite. Kolejność przełączenia logowania i kopiowania może być dobrana po inwentaryzacji; oba warunki muszą być spełnione przed odcięciem źródła.
6. Kopiować obiekty Appwrite -> R2 wznawialnym narzędziem administracyjnym, bez pośrednictwa przeglądarki. Zapewnić obsługę dużych plików, limitów API, przerwań i czyszczenia nieukończonych uploadów multipart.
7. Dla każdego pliku potwierdzić liczbę bajtów i hash treści źródła oraz odczytu docelowego. Sam zapis hasha źródła jako metadanych R2 nie dowodzi integralności kopii. ETag multipart nie jest zwykłym hashem całego pliku.
8. Przełączać tylko zweryfikowane pliki, warunkowo względem niezmienionej lokalizacji i wersji rekordu; uwzględnić wszystkie operacyjne odczyty lokalizacji i kosza. Konflikt oznacza ponowne uzgodnienie, a nie nadpisanie.
9. Przed końcowym przełączeniem zastosować krótkie okno blokady mutacji objętych migracją, rozliczyć rozpoczęte operacje, wykonać końcowy diff i przeliczyć liczniki. Kopiowanie wstępne może odbywać się wcześniej.
10. Zweryfikować własne i wspólne pliki, pobieranie, podglądy, kosz/przywracanie, slugi, limity, uprawnienia i wyceny. Sprawdzić, że żądania Chmury nie wywołują Appwrite, a stare API Releases jest wyłączone.
11. Zachować źródło i manifest do odrębnej decyzji o sprzątaniu. Po wznowieniu mutacji rollback wymaga uzgodnienia nowych zmian; nie może polegać na bezwarunkowym odtworzeniu starego snapshotu.

Plików z kosza nie usuwać przez pominięcie w migracji. Dla rekordów świadomie przeznaczonych do trwałego usunięcia trzeba zachować stan operacji i rozstrzygnąć go przed kopiowaniem lub cleanupem. Osieroconych obiektów nie publikować i nie usuwać automatycznie.

## Konkretne luki i granica repozytorium

- Lokalny silnik migracji jest kierunkowy R2 -> Appwrite. Jego schemat i operacje nie stanowią gotowej migracji Appwrite -> R2.
- Część admin API UniSource wciąż pobiera profile i zmienia konta przez Appwrite. Sama migracja logowania Chmury tego nie usuwa.
- Dostęp Clerk jest mapowany przez istniejące tożsamości; potrzebne jest sprawdzenie kompletności mapowania dla Chmury oraz obsługi nowych użytkowników.
- Wyłączenie zadań, zmiana backendowego modelu ról/profili, uzgodnienie lokalizacji i ewentualne nowe kontrakty należą do UniSource.
- Zgodnie z AGENTS.md w tym zadaniu UniSource pozostaje referencją tylko do odczytu. Nie wykonano w nim zmian, commitów, publikacji ani wdrożeń. Przed implementacją tych zmian potrzebna jest jawna zgoda na osobny zakres UniSource.
- Nie zakładać, że EOL Releases w Chmurze upoważnia do wyłączenia wspólnych mechanizmów wydań lub usunięcia danych używanych przez inne usługi.

## Warunki zakończenia

- Każdy zachowywany użytkownik ma rozstrzygnięte powiązanie Clerk i własność danych.
- Każdy zachowywany plik Chmury ma zweryfikowany obiekt R2; nie ma nierozliczonych konfliktów lokalizacji ani pominiętych rekordów kosza.
- Dane D1 zachowują identyfikatory i relacje; liczniki i limity są zgodne z przyjętą semantyką, bez podwójnego naliczania kopii.
- Brak wymaganych odczytów i zapisów Appwrite w ścieżkach działania Chmury, łącznie z administracją.
- Releases oraz produktowe funkcje migracji są wyłączone dla Chmury; inne usługi pozostają poza zakresem.
- Raport zawiera faktyczne wyniki kontroli i listę wyjątków. Brak dostępu do danych źródłowych jest blokadą migracji tych danych, nie potwierdzeniem ich braku.

## Źródła

- Chmura: `src/lib/server/unisource.ts`, `unisource-mappers.ts`, `roles.ts`, `externalConfig.ts`, `src/lib/modules/upload.svelte.ts`, `scripts/init-db.ts`.
- UniSource, odczyt referencyjny: `apps/backend/src/db/migrations/0001_uploads.sql`, `0002_files_and_folders.sql`, `0003_multi_service_and_fixes.sql`, `0007_share_links.sql`, `0008_admin_user_management.sql`, `0009_main_storage.sql`, `0023_storage_migrations.sql`, `0024_quotations.sql`.
- UniSource, odczyt referencyjny: `apps/backend/src/db/blokserwis-migrations/0001_foundations.sql`, `0005_identity_provider_links.sql`, `src/middleware/auth.ts`, `src/db/v1/storageMigrations.ts`, `src/routes/v2/admin.ts`, `adminFiles.ts`, `files.ts`, `public.ts`, `scripts/migrate-appwrite-users-to-clerk.mjs`.
- [Clerk: migracja danych użytkowników](https://clerk.com/docs/guides/development/migrating/overview).
- [Cloudflare R2: upload i semantyka ETag multipart](https://developers.cloudflare.com/r2/objects/upload-objects/).
