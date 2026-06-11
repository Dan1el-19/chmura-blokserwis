# UniSource V2 Beta Migration Design

## Cel

Zmigrować `chmura-blokserwis` z legacy `UnisourceClient` i API bez prefiksu na
`UnisourceV2Client` oraz API `/v2`, bez zmiany lub przestoju produkcyjnego
Workera `chmura-blokserwis` obsługującego `https://chmura.blokserwis.pl`.

Migracja jest najpierw wdrażana jako równoległy Worker
`chmura-blokserwis-beta` pod `https://beta.chmura.blokserwis.pl`. Beta używa
tych samych danych, usługi UniSource i projektu Appwrite co produkcja.

## Decyzja Architektoniczna

Beta obejmuje wyłącznie osobny Worker aplikacji `chmura-blokserwis`.
Nie wdrażamy osobnego `unisource-api-beta`.

Worker beta wywołuje produkcyjny endpoint `UNISOURCE_URL`, ale przez trasy
`/v2/*`, ponieważ prefiks jest wybierany przez `UnisourceV2Client`. Oba Workery
używają identycznych:

- `UNISOURCE_URL`
- `UNISOURCE_SERVICE_ID`
- `UNISOURCE_API_KEY`
- projektu Appwrite i jego auth
- storage R2/Appwrite zarządzanego przez UniSource
- Upstash rate limiting

Ten wariant izoluje kod aplikacji beta, a jednocześnie nie uruchamia drugiej
wersji backendu zapisującej bezpośrednio do produkcyjnej bazy i bucketów.

## Rozważone Warianty

1. **Osobny Worker aplikacji beta + produkcyjny UniSource API V2
   (wybrany).** Najmniejszy blast radius, brak drugiego backendu zapisującego
   do tych samych danych i prosty rollback przez wyłączenie route beta.
2. **Osobny Worker aplikacji beta + osobny UniSource API beta podpięty do
   produkcyjnych D1/R2/Appwrite.** Odrzucony, ponieważ dwie wersje backendu
   mogłyby równolegle modyfikować te same dane i różnie interpretować stan.
3. **Przełączenie stable Workera flagą na SDK V2.** Odrzucony na etap beta,
   ponieważ błąd kontraktu od razu dotknąłby wszystkich użytkowników i nie
   spełniałby wymogu równoległego środowiska.

## Niezmienniki Bezpieczeństwa

1. `main`, produkcyjny Worker, jego route i sekrety nie są modyfikowane ani
   wdrażane w fazie beta.
2. Deployment beta zawsze używa `wrangler deploy --env beta`.
3. Beta ma inną nazwę Workera i inną trasę DNS.
4. Beta używa tego samego `UNISOURCE_SERVICE_ID`; inny service ID utworzyłby
   inny zakres danych.
5. SDK jest przypięte dokładnie do zatwierdzonego prerelease zawierającego
   pełny kontrakt wymagany przez aplikację, planowanego jako `1.1.1-beta.1`.
   Nie używamy zakresu `^`, aby beta nie zmieniła kontraktów bez przeglądu.
6. Testy mutujące wspólne dane używają dedykowanego użytkownika beta oraz
   nazw z prefiksem `beta-e2e-`.
7. Nie wykonujemy migracji D1 ani zmian backendu UniSource w tym wdrożeniu.
8. Przed każdym wdrożeniem beta wykonywany jest sentinel produkcji. Po
   wdrożeniu sentinel jest powtarzany.
9. Beta używa tego samego projektu i kont Appwrite, ale zachowuje osobny,
   host-only cookie sesji. Użytkownik może wymagać osobnego logowania na beta;
   nie rozszerzamy cookie stable na `.blokserwis.pl`.

## Źródło Prawdy Kontraktów

Źródłem prawdy jest kod SDK i backendu w rewizji UniSource:

`271606becdb9e6429684480f857d094a4e2de850`

Dokumentacja V2 jest pomocnicza, ale nie może zastępować kompilacji i testów
kontraktowych. Wykryte różnice obejmują między innymi:

- dokumentacja opisuje miejscami `data`, podczas gdy kod V2 używa `item`,
  `items` i `page`;
- dokumentacja opisuje `client.upload.complete(body)`, a kod SDK przyjmuje
  `complete(uploadId, signal?, options?)`;
- dokumentacja opisuje metody multipart jako ścieżki z parametrem, a kod SDK
  zachowuje część query-based endpointów;
- SDK zawiera unie zgodności dla wybranych odpowiedzi legacy/V2.

Dlatego migracja ma najpierw wprowadzić lokalną warstwę adapterów kontraktu,
która normalizuje odpowiedzi SDK do modeli używanych przez aplikację.

## Architektura Aplikacji Po Migracji

```text
Browser
  |
  +-- https://chmura.blokserwis.pl       -> stable Worker, legacy SDK/API
  |
  +-- https://beta.chmura.blokserwis.pl  -> beta Worker, SDK V2/API /v2
                                                |
                                                +-> ten sam UniSource API
                                                +-> ten sam service ID
                                                +-> ten sam D1/R2/Appwrite
```

Fabryki w `src/lib/server/unisource.ts` nadal są jedynym miejscem tworzenia
klientów. Po migracji zwracają `UnisourceV2Client`:

- klient użytkownika: Appwrite JWT pobierany per request;
- klient administratora: statyczny `apiKey`;
- klient publiczny: anonimowy zasób `client.public`.

Warstwa `src/lib/server/unisource-v2-contract.ts` zapewnia:

- rozpakowanie `item` i kompatybilnych kopert zasobów;
- rozpakowanie `items/page` oraz kompatybilnych list;
- mapowanie `UnisourceV2Error` do lokalnych odpowiedzi API;
- jednoznaczne typy wejściowe dla mapperów.

## Macierz Migracji SDK

| Legacy                                               | V2                                                         | Istotna zmiana                        |
| ---------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| `UnisourceClient`                                    | `UnisourceV2Client`                                        | import z `@unisource/sdk/v2`          |
| `getToken: () => apiKey`                             | `apiKey`                                                   | tryby auth są wzajemnie wykluczające  |
| `admin.serviceDetail()`                              | `admin.getService()`                                       | nazwa metody                          |
| `admin.usage()`                                      | `admin.getServiceUsage()`                                  | nazwa metody                          |
| `myFiles.trash()`                                    | `myFiles.listTrash()`                                      | nazwa metody                          |
| `myFiles.get/update/delete/restore/downloadUrl`      | `userFiles.*`                                              | nowy namespace                        |
| `myFiles.move()`                                     | `myFiles.move()`                                           | odpowiedź akcji, bez pełnego pliku    |
| `folders.list(...).next_cursor`                      | `folders.list(...).page.next_cursor`                       | koperta listy                         |
| `folders.list({ is_trashed })`                       | `folders.list({ trash })`                                  | `active/trashed/all`                  |
| ręczne breadcrumbs przez `folders.get()`             | `folders.breadcrumbs()`                                    | jeden request                         |
| `folders.delete(id, { permanent }, signal, options)` | `folders.delete(id, signal, { permanent, asUser })`        | kolejność argumentów                  |
| `shareLinks.list(fileId)`                            | `shareLinks.listForFile(fileId)`                           | nazwa metody                          |
| `upload.multipart.*`                                 | `upload.multipartCreate/SignPart/ListParts/Complete/Abort` | spłaszczony namespace                 |
| `upload.complete(body)`                              | `upload.complete(uploadId, signal, options)`               | nowa sygnatura                        |
| `upload.fail()`                                      | brak metody w SDK, endpoint API istnieje                   | dodać metodę do SDK V2 przed migracją |
| `mainStorage.upload.*`                               | `upload.*` z `is_main_storage`                             | wspólny namespace upload              |
| `releases.upload.*`                                  | `releases.uploadInit/Complete/Fail`                        | spłaszczony namespace                 |
| `releases.upload.multipart.*`                        | `releases.multipart*`                                      | spłaszczony namespace                 |
| `UnisourceError`                                     | `UnisourceV2Error`                                         | `code`, `requestId`, `details`        |
| helpery publiczne z root exportu                     | `client.public.*`                                          | publiczny namespace V2                |

## Braki I Blokery Kontraktowe

Przed migracją mutacji trzeba rozstrzygnąć następujące różnice:

1. API V2 udostępnia `POST /v2/upload/fail`, ale SDK V2 nie udostępnia metody
   `uploadFail`. Przed migracją aplikacji należy dodać metodę i testy do SDK,
   opublikować prerelease oraz przypiąć jego dokładną wersję w beta.
2. `mainStorage` w SDK V2 nie ma namespace `upload`. Wszystkie uploady main
   muszą przejść przez `client.upload.*` z `is_main_storage: true`.
3. V2 `myFiles.move()` zwraca wynik akcji, nie pełny rekord pliku. Endpoint
   aplikacji powinien zwrócić `{ success: true }` albo wykonać osobny
   `userFiles.get()`.
4. V2 `folders.update()` nie obsługuje przenoszenia. Przenoszenie folderów
   należy realizować przez `folders.bulkMove()`.
5. Produkcyjny UniSource musi mieć ustawiony `CURSOR_HMAC_SECRET`, ponieważ
   beta będzie korzystać z paginacji V2 na tych samych danych.

## Deployment Beta

`wrangler.jsonc` zachowuje top-level stable bez zmian i dodaje `env.beta`.
Cloudflare tworzy osobny Worker środowiskowy. Route, vars i sekrety są
niezależne dla środowiska i muszą zostać jawnie skonfigurowane.

Beta route:

`beta.chmura.blokserwis.pl/*`

Wymagane działania infrastrukturalne:

1. Utworzyć proxied DNS dla `beta.chmura.blokserwis.pl`.
2. Dodać beta origin/platform do projektu Appwrite.
3. Dodać `https://beta.chmura.blokserwis.pl` do CORS bucketów używanych przez
   bezpośredni upload przeglądarkowy.
4. Skopiować te same wartości sekretów do Workera beta z bezpiecznego źródła.
   Sekretów nie można odczytać z istniejącego Workera przez Wrangler.
5. Opcjonalnie chronić beta subdomain Cloudflare Access. Appwrite pozostaje
   wewnętrznym mechanizmem auth aplikacji.
6. Przekazać `PUBLIC_APPWRITE_ENDPOINT`, `PUBLIC_APPWRITE_PROJECT_ID` i
   `PUBLIC_APPWRITE_PROJECT_NAME` również podczas builda, ponieważ klient
   przeglądarkowy importuje je z `$env/static/public`.
7. Ustawić `UPSTASH_REDIS_REST_URL` i token w beta. Zmienne środowiskowe oraz
   sekrety nie są dziedziczone przez środowiska Wrangler.

## Rollout

1. Zamrozić wersję SDK/API i przejść testy UniSource.
2. Zmigrować aplikację na osobnej gałęzi.
3. Uruchomić lokalne testy i build.
4. Wykonać `wrangler deploy --dry-run --env beta`.
5. Sprawdzić produkcyjny sentinel.
6. Wdrożyć wyłącznie Worker beta.
7. Wykonać smoke test read-only.
8. Wykonać kontrolowane testy mutujące dedykowanym użytkownikiem beta.
9. Obserwować błędy, request IDs i wpływ na produkcję przez minimum 7 dni.
10. Dopiero po akceptacji przygotować osobny PR promujący migrację do `main`.

## Rollback

Rollback beta nie wymaga dotykania stable:

1. Wyłączyć route beta lub cofnąć wersję Workera beta.
2. Zachować stable Worker bez zmian.
3. Usunąć dane testowe utworzone przez dedykowanego użytkownika beta.
4. Nie wykonywać rollbacku schematu, ponieważ ta migracja go nie zmienia.

Po promocji do stable rollback aplikacji polega na wdrożeniu poprzedniej
wersji Workera stable. Legacy API pozostaje dostępne w UniSource, dlatego
rollback kodu nie wymaga rollbacku backendu.

## Kryteria Akceptacji

- `main` i `chmura.blokserwis.pl` działają bez przerwy przez cały rollout.
- Beta działa jako osobny Worker i osobna trasa.
- Beta loguje użytkowników przez ten sam projekt Appwrite.
- Ten sam użytkownik widzi te same pliki w stable i beta.
- Zmiany wykonane w beta są widoczne w stable i odwrotnie.
- Listowanie, breadcrumbs, kosz, CRUD, udostępnienia, upload R2, upload
  Appwrite, multipart, main storage, admin i releases przechodzą testy.
- Błędy V2 zachowują `code` i `request_id` w logach.
- Żaden deployment beta nie wykonuje `wrangler deploy` bez `--env beta`.
- `pnpm check`, `pnpm lint`, testy i build przechodzą na przypiętym SDK.
