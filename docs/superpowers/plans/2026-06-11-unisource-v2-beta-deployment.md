# UniSource V2 Beta Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uruchomić równoległy Worker beta `chmura-blokserwis` korzystający z
UniSource SDK/API V2 oraz wspólnych produkcyjnych danych i auth, bez zmiany lub
przestoju Workera stable.

**Architecture:** Aplikacja beta powstaje z osobnej gałęzi i jest wdrażana przez
`wrangler --env beta` jako osobny Worker pod osobnym subdomain. Fabryki klienta
UniSource przechodzą na `UnisourceV2Client`, a lokalna warstwa adapterów
normalizuje koperty V2 przed przekazaniem danych do istniejącego UI.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Vitest, Playwright,
Cloudflare Workers/Wrangler 4, Appwrite, UniSource SDK V2.

---

## Założenia Wykonawcze

- Gałąź implementacyjna: `codex/unisource-v2-beta`.
- Rewizja odniesienia UniSource:
  `271606becdb9e6429684480f857d094a4e2de850`.
- Obecny stabilny SDK: `@unisource/sdk@1.1.0`.
- Beta przypina dokładny prerelease zawierający brakujące `uploadFail`,
  planowany jako `@unisource/sdk@1.1.1-beta.1`.
- Worker stable: `chmura-blokserwis`.
- Worker beta: `chmura-blokserwis-beta`.
- Stable URL: `https://chmura.blokserwis.pl`.
- Beta URL: `https://beta.chmura.blokserwis.pl`.
- UniSource API, service ID, API key, Appwrite i storage są wspólne.
- Nie wdrażamy `A:\Projects\UniSource\apps\backend`; wymagamy jedynie, aby
  aktualny produkcyjny backend zawierał V2 z zatwierdzonej rewizji.

## Pliki Docelowe

**Nowe:**

- `.github/workflows/beta-deploy.yml` — izolowany pipeline Workera beta.
- `scripts/validate-beta-workflow.mjs` — blokada deployu stable z workflow beta.
- `src/lib/server/unisource-v2-contract.ts` — normalizacja kopert V2.
- `src/lib/server/unisource-v2-contract.spec.ts` — testy normalizacji.
- `src/lib/server/unisource.spec.ts` — testy trybów auth fabryk V2.
- `src/lib/server/unisource-errors.spec.ts` — testy błędów V2.
- `docs/runbooks/unisource-v2-beta.md` — operacyjny runbook deploy/rollback.

**Modyfikowane:**

- `package.json`, `pnpm-lock.yaml` — dokładna wersja SDK i skrypty beta.
- `wrangler.jsonc`, `worker-configuration.d.ts` — środowisko beta.
- `src/lib/server/unisource.ts` — fabryki klienta V2 i public API.
- `src/lib/server/unisource-errors.ts` — `UnisourceV2Error`.
- `src/lib/server/unisource-mappers.ts` — typy V2.
- `src/lib/server/release-multipart-client.ts` — usunięcie legacy castu.
- `src/lib/server/storage/releases.ts`, `src/lib/types/releases.ts` — koperty
  i typy releases V2.
- serwerowe loady i endpointy w `src/routes/**` korzystające z UniSource.
- istniejące testy tras i mapperów.
- `README.md`, `.env.example` — workflow beta i wymagane zmienne.

## Task 1: Uzupełnienie Brakującego Kontraktu SDK V2

- [ ] **Step 1: Dodaj failing test SDK dla `uploadFail`**

W `A:\Projects\UniSource\packages\unisource-sdk` dodaj test zasobu upload,
który oczekuje:

```ts
await client.upload.uploadFail('upload-1');
```

Request musi używać:

```text
POST /v2/upload/fail
body: { "upload_id": "upload-1" }
```

oraz parsera `v2UploadLifecycleResponseSchema`.

Run:

```powershell
pnpm --dir A:\Projects\UniSource --filter @unisource/sdk test -- --run
```

Expected: FAIL, `uploadFail` nie istnieje.

- [ ] **Step 2: Zaimplementuj i wyeksportuj metodę**

Modify:

- `A:\Projects\UniSource\packages\unisource-sdk\src\v2\resources\upload.ts`
- test zasobu upload V2
- `A:\Projects\UniSource\docs\sdk\v2\resources\upload.md`
- changeset SDK

Sygnatura:

```ts
uploadFail: (uploadId: string, signal?: AbortSignal, options?: { asUser?: string }) =>
	Promise<V2UploadLifecycleResponse>;
```

- [ ] **Step 3: Zweryfikuj SDK i backend**

Run:

```powershell
pnpm --dir A:\Projects\UniSource --filter @unisource/sdk test -- --run
pnpm --dir A:\Projects\UniSource --filter backend test -- --run
```

Expected: PASS.

- [ ] **Step 4: Opublikuj prerelease beta SDK**

Uruchom `sdk-beta-release.yml` z patch bump. Oczekiwany pakiet:

```text
@unisource/sdk@1.1.1-beta.1
```

Nie wdrażaj nowego backendu: endpoint API V2 już istnieje.

- [ ] **Step 5: Commit w UniSource**

```powershell
git -C A:\Projects\UniSource add packages/unisource-sdk docs/sdk/v2 .changeset
git -C A:\Projects\UniSource commit -m "fix(sdk): dodaj uploadFail do klienta v2"
```

## Task 2: Utworzenie Izolowanej Gałęzi I Zamrożenie Kontraktu

- [ ] **Step 1: Utwórz gałąź z aktualnego `origin/main`**

Run:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/unisource-v2-beta
```

Expected: `git status --short --branch` pokazuje
`codex/unisource-v2-beta` i czyste drzewo.

- [ ] **Step 2: Potwierdź stan UniSource**

Run:

```powershell
git -C A:\Projects\UniSource rev-parse HEAD
pnpm --dir A:\Projects\UniSource --filter @unisource/sdk test -- --run
pnpm --dir A:\Projects\UniSource --filter backend test -- --run
pnpm view @unisource/sdk version dist-tags --json
```

Expected:

- rewizja jest zatwierdzona przez osobę wdrażającą;
- SDK: wszystkie testy przechodzą;
- backend: wszystkie testy przechodzą;
- npm `latest` wskazuje zatwierdzoną wersję, początkowo `1.1.0`.

- [ ] **Step 3: Przypnij SDK beta dokładnie**

Run:

```powershell
pnpm add @unisource/sdk@1.1.1-beta.1 --save-exact
```

Expected: `package.json` i `pnpm-lock.yaml` wskazują dokładnie
`1.1.1-beta.1`.

- [ ] **Step 4: Zweryfikuj eksport V2 z pakietu npm**

Run:

```powershell
node -e "import('@unisource/sdk/v2').then(m => { if (!m.UnisourceV2Client || !m.UnisourceV2Error) process.exit(1); console.log('v2 exports ok') })"
```

Expected: `v2 exports ok`.

- [ ] **Step 5: Commit**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore(sdk): przypnij beta UniSource SDK v2"
```

## Obowiązkowa Bramka Baseline Przed Task 3

Stan zmierzony 2026-06-11 przed migracją:

- `pnpm check`: PASS, 0 błędów i 0 ostrzeżeń;
- `pnpm build`: PASS;
- `pnpm test:unit -- --run`: FAIL, 92/93 testów PASS; istniejący
  `src/routes/page.svelte.spec.ts` oczekuje `h1`, którego aktualny
  `StoragePage` nie renderuje;
- `pnpm lint`: FAIL przed ESLint; istniejące błędy kompatybilności
  Prettier/Svelte w `UserRoleCard.svelte`, `ShareDialog.svelte`,
  `MobileDrawer.svelte`, `admin/users/+page.svelte` oraz istniejące
  nieformatowane pliki.

Przed Task 3 należy w osobnym prerequisite commicie:

1. rozstrzygnąć kontrakt dostępności strony głównej: dodać właściwy `h1`
   „Moje pliki” albo zmienić test na zatwierdzony semantyczny element;
2. naprawić zgodność wersji Prettier, `prettier-plugin-svelte` i
   `prettier-plugin-tailwindcss` bez masowego formatowania niezwiązanego kodu;
3. sformatować wyłącznie zatwierdzony zakres;
4. uzyskać PASS dla `pnpm check`, `pnpm lint`, `pnpm test:unit -- --run` i
   `pnpm build`.

Nie rozpoczynaj migracji SDK z czerwonym baseline, ponieważ uniemożliwia to
odróżnienie regresji V2 od istniejących problemów.

## Task 3: Warstwa Kontraktu V2

- [ ] **Step 1: Dodaj failing tests normalizacji kopert**

Create `src/lib/server/unisource-v2-contract.spec.ts` z przypadkami:

- `{ item }` zwraca `item`;
- `{ file }`, `{ folder }`, `{ service }`, `{ user }` są rozpakowywane;
- `{ items, page }` zwraca `items`, `page.next_cursor`, `page.limit`;
- kompatybilna lista `{ items, next_cursor, limit }` jest normalizowana;
- brak znanej koperty rzuca błąd kontraktu.

Run:

```powershell
pnpm test:unit -- --run src/lib/server/unisource-v2-contract.spec.ts
```

Expected: FAIL, moduł nie istnieje.

- [ ] **Step 2: Zaimplementuj adaptery**

Create `src/lib/server/unisource-v2-contract.ts` z eksportami:

```ts
export type NormalizedList<T> = {
	items: T[];
	nextCursor: string | null;
	limit: number;
};

export function unwrapItem<T>(response: unknown): T;
export function unwrapList<T>(response: unknown): NormalizedList<T>;
```

Adapter ma akceptować wyłącznie znane koperty SDK V2 i rzucać opisowy błąd
z nazwą brakującej koperty. Nie może domyślnie zwracać `response as T`.

- [ ] **Step 3: Uruchom testy adaptera**

Run:

```powershell
pnpm test:unit -- --run src/lib/server/unisource-v2-contract.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/server/unisource-v2-contract.ts src/lib/server/unisource-v2-contract.spec.ts
git commit -m "feat(sdk): dodaj adaptery kontraktu UniSource v2"
```

## Task 4: Fabryki Klienta I Błędy V2

- [ ] **Step 1: Dodaj testy fabryk**

Create `src/lib/server/unisource.spec.ts`. Zamockuj Appwrite i runtime env,
następnie sprawdź:

- klient użytkownika używa `getToken`, nie `apiKey`;
- klient admina używa `apiKey`, nie `getToken`;
- oba ustawiają wspólny `baseUrl`, `serviceId` i `silentBeta: true`;
- klient publiczny nie wymaga auth.

Run:

```powershell
pnpm test:unit -- --run src/lib/server/unisource.spec.ts
```

Expected: FAIL na legacy `UnisourceClient`.

- [ ] **Step 2: Zmigruj `src/lib/server/unisource.ts`**

Zmiany:

- import `UnisourceV2Client` z `@unisource/sdk/v2`;
- user client: `getToken`;
- admin client: `apiKey`;
- zachowaj `ensureServiceUserAccess`, ale użyj `admin.updateUser`;
- zastąp root helpery publiczne wywołaniami `client.public.getShareLink()` i
  `client.public.unlockShareLink()`;
- ustaw `silentBeta: true`, aby nie spamować logów Workera.

- [ ] **Step 3: Dodaj testy mapowania błędów**

Create `src/lib/server/unisource-errors.spec.ts` i sprawdź:

- `UnisourceV2Error` zachowuje status i czytelny message;
- odpowiedź zawiera `code` i `requestId`;
- `forbidden` i `gone` mapują stan publicznego linku;
- nieznany błąd daje 500 bez ujawnienia stack trace.

- [ ] **Step 4: Zmigruj `src/lib/server/unisource-errors.ts`**

Użyj `UnisourceV2Error` z `@unisource/sdk/v2`. Odpowiedzi lokalnych endpointów
powinny mieć:

```json
{
	"error": "czytelny komunikat",
	"code": "not_found",
	"requestId": "req_..."
}
```

- [ ] **Step 5: Uruchom testy**

Run:

```powershell
pnpm test:unit -- --run src/lib/server/unisource.spec.ts src/lib/server/unisource-errors.spec.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/server/unisource.ts src/lib/server/unisource.spec.ts src/lib/server/unisource-errors.ts src/lib/server/unisource-errors.spec.ts
git commit -m "feat(sdk): przełącz fabryki klientów na UniSource v2"
```

## Task 5: Mappery I Typy Domenowe

- [ ] **Step 1: Rozszerz testy mapperów**

Modify `src/lib/server/unisource-mappers.spec.ts` o modele V2:

- plik i folder zachowują identyczny lokalny model Appwrite-style;
- timestampy Unix są mapowane do ISO;
- share link i admin user zachowują wszystkie pola używane przez UI;
- publiczny link locked/unlocked mapuje się poprawnie.

- [ ] **Step 2: Zmigruj typy mapperów**

Modify:

- `src/lib/server/unisource-mappers.ts`
- `src/lib/types/releases.ts`
- `src/lib/server/storage/releases.ts`

Importuj typy z `@unisource/sdk/v2` lub wyprowadzaj je z odpowiedzi metod.
Rozpakowuj `item/items/page` przez adapter kontraktu. Nie zmieniaj modeli
przekazywanych do istniejących komponentów Svelte.

- [ ] **Step 3: Uruchom testy**

Run:

```powershell
pnpm test:unit -- --run src/lib/server/unisource-mappers.spec.ts src/routes/releases/page.server.spec.ts src/routes/api/releases/[releaseId]/server.spec.ts
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/server/unisource-mappers.ts src/lib/server/unisource-mappers.spec.ts src/lib/types/releases.ts src/lib/server/storage/releases.ts
git commit -m "refactor(sdk): dostosuj modele aplikacji do UniSource v2"
```

## Task 6: Migracja Odczytów I Paginacji

- [ ] **Step 1: Dodaj testy list i breadcrumbs**

Rozszerz istniejące testy loadów i endpointów o:

- `items/page.next_cursor`;
- `myFiles.listTrash`;
- `folders.list({ trash: 'trashed' })`;
- `folders.breadcrumbs(id)` bez ręcznej pętli;
- admin `getService`, `getServiceUsage`, `listUsers`;
- main storage i releases z kopertami V2.

- [ ] **Step 2: Zmigruj loady i endpointy read-only**

Modify:

- `src/routes/+page.server.ts`
- `src/routes/trash/+page.server.ts`
- `src/routes/preview/[userId]/+page.server.ts`
- `src/routes/main/+page.server.ts`
- `src/routes/admin/+page.server.ts`
- `src/routes/admin/users/+page.server.ts`
- `src/routes/admin/users/[userId]/+page.server.ts`
- `src/routes/admin/settings/+page.server.ts`
- `src/routes/+layout.server.ts`
- `src/routes/api/files/+server.ts`
- `src/routes/api/folders/+server.ts`
- `src/routes/api/main/+server.ts`
- `src/routes/api/releases/sync/+server.ts`

Zachowaj istniejące odpowiedzi lokalnych endpointów, aby frontend nie musiał
zmieniać kontraktów równocześnie z migracją upstream.

- [ ] **Step 3: Uruchom read-only suite**

Run:

```powershell
pnpm test:unit -- --run
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/routes src/lib/server/storage/releases.ts
git commit -m "feat(sdk): zmigruj odczyty i paginację na UniSource v2"
```

## Task 7: Migracja CRUD Plików, Folderów I Shares

- [ ] **Step 1: Dodaj testy mutacji**

Dodaj lub rozszerz testy endpointów dla:

- `userFiles.get/update/delete/restore/downloadUrl`;
- `myFiles.move`;
- `folders.create/update/delete/restore/bulkMove`;
- `shareLinks.listForFile/create/update/delete`;
- poprawnej kolejności `signal/options`.

- [ ] **Step 2: Zmigruj endpointy**

Modify:

- `src/routes/api/files/[fileId]/+server.ts`
- `src/routes/api/folders/+server.ts`
- `src/routes/api/folders/[folderId]/+server.ts`
- `src/routes/api/shares/+server.ts`
- `src/routes/api/shares/[shareId]/+server.ts`

Szczególne zasady:

- rename pliku używa `userFiles.update`;
- move pliku używa `myFiles.move` i zwraca lokalne `{ success: true }`;
- move folderu używa `folders.bulkMove({ ids: [id], parent_id })`;
- delete przekazuje `{ permanent, asUser }` w opcjach V2;
- list shares używa `listForFile`.

- [ ] **Step 3: Uruchom testy**

Run:

```powershell
pnpm test:unit -- --run
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/routes/api/files src/routes/api/folders src/routes/api/shares
git commit -m "feat(sdk): zmigruj operacje plików i folderów na v2"
```

## Task 8: Migracja Uploadów

- [ ] **Step 1: Potwierdź dostępność `uploadFail`**

Run:

```powershell
node -e "import('@unisource/sdk/v2').then(m => { const c = new m.UnisourceV2Client({ baseUrl: 'https://example.invalid', serviceId: 'test', silentBeta: true }); if (typeof c.upload.uploadFail !== 'function') process.exit(1); })"
```

Expected: exit code 0.

- [ ] **Step 2: Dodaj testy zwykłego uploadu**

Sprawdź R2 i Appwrite dla user/main:

- `upload.r2Init` / `upload.appwriteInit` z `is_main_storage`;
- `upload.complete(uploadId, ..., { isMainStorage })`;
- rozpakowanie `item`;
- brak wywołań `mainStorage.upload`.

- [ ] **Step 3: Dodaj testy multipart**

Sprawdź:

- `multipartCreate`;
- `multipartSignPart`;
- `multipartListParts`;
- `multipartComplete(uploadId, parts)`;
- `multipartAbort`;
- zachowanie lokalnego formatu oczekiwanego przez Uppy.

- [ ] **Step 4: Zmigruj endpointy upload**

Modify wszystkie pliki pod:

- `src/routes/api/upload/**`

Usuń namespace `upload.multipart` i `mainStorage.upload`. Zachowaj lokalne
payloady Uppy, np. `{ key, uploadId }`, nawet jeśli upstream V2 zwraca
`{ item: ... }`.

- [ ] **Step 5: Uruchom testy**

Run:

```powershell
pnpm test:unit -- --run
pnpm check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/routes/api/upload
git commit -m "feat(sdk): zmigruj uploady plików na UniSource v2"
```

## Task 9: Migracja Releases I Admin

- [ ] **Step 1: Usuń legacy cast multipart**

Modify `src/lib/server/release-multipart-client.ts`, aby delegował bezpośrednio
do `client.releases.multipartCreate`, `multipartSignPart`,
`multipartListParts`, `multipartComplete` i `multipartAbort`.

- [ ] **Step 2: Zmigruj releases**

Modify wszystkie pliki pod `src/routes/api/releases/**` oraz
`src/lib/server/storage/releases.ts`:

- `uploadInit`;
- `uploadComplete(releaseId, size)`;
- `uploadFail(releaseId)`;
- spłaszczone multipart;
- `item/items/page`.

- [ ] **Step 3: Zmigruj admin**

Modify:

- `src/routes/admin/**`
- `src/routes/api/admin/**`
- `src/routes/+layout.server.ts`

Użyj `getService`, `getServiceUsage`, `updateServiceSettings`,
`updateUserRole`, `updateUserStorageLimit` i `resetUserPassword` zgodnie z
rzeczywistymi schematami SDK V2.

- [ ] **Step 4: Uruchom testy**

Run:

```powershell
pnpm test:unit -- --run
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/server/release-multipart-client.ts src/lib/server/storage/releases.ts src/routes/admin src/routes/api/admin src/routes/api/releases src/routes/+layout.server.ts
git commit -m "feat(sdk): zmigruj releases i administrację na UniSource v2"
```

## Task 10: Konfiguracja Workera Beta

- [ ] **Step 1: Dodaj failing validation konfiguracji**

Run przed zmianą:

```powershell
pnpm exec wrangler deploy --dry-run --env beta
```

Expected: FAIL, środowisko beta nie istnieje.

- [ ] **Step 2: Dodaj `env.beta` do `wrangler.jsonc`**

Top-level stable pozostaje bez zmian. Dodaj środowisko z:

```jsonc
"env": {
  "beta": {
    "name": "chmura-blokserwis-beta",
    "workers_dev": false,
    "route": {
      "pattern": "beta.chmura.blokserwis.pl/*",
      "zone_name": "blokserwis.pl"
    },
    "vars": {
      "PUBLIC_APPWRITE_PROJECT_NAME": "Chmura Blokserwis Beta",
      "ORIGIN": "https://beta.chmura.blokserwis.pl"
    },
    "secrets": {
      "required": [
        "APPWRITE_API_KEY",
        "UNISOURCE_URL",
        "UNISOURCE_SERVICE_ID",
        "UNISOURCE_API_KEY",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
        "PUBLIC_APPWRITE_ENDPOINT",
        "PUBLIC_APPWRITE_PROJECT_ID",
        "R2_ENDPOINT",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME"
      ]
    }
  }
}
```

- [ ] **Step 3: Dodaj bezpieczne skrypty**

Modify `package.json`:

```json
"build:beta": "vite build",
"deploy:beta:dry": "pnpm run build:beta && wrangler deploy --dry-run --env beta",
"deploy:beta": "pnpm run build:beta && wrangler deploy --env beta"
```

Nie dodawaj skryptu, który wdraża stable z gałęzi beta.

- [ ] **Step 4: Wygeneruj typy i sprawdź konfigurację**

Run:

```powershell
pnpm exec wrangler types --env beta
pnpm deploy:beta:dry
```

Expected: PASS; wynik dry-run wskazuje `chmura-blokserwis-beta`, nie stable.

- [ ] **Step 5: Commit**

```powershell
git add wrangler.jsonc worker-configuration.d.ts package.json
git commit -m "feat(frontend): dodaj izolowany deployment beta"
```

## Task 11: Pipeline Beta

- [ ] **Step 1: Dodaj workflow**

Create `.github/workflows/beta-deploy.yml`:

- trigger `workflow_dispatch` oraz push wyłącznie do
  `codex/unisource-v2-beta`;
- GitHub Environment `beta`;
- `concurrency: chmura-blokserwis-beta`;
- checkout, pnpm, Node, frozen install;
- weryfikacja dokładnej wersji SDK;
- `pnpm check`;
- `pnpm lint`;
- `pnpm test:unit -- --run`;
- `pnpm build`;
- build otrzymuje `PUBLIC_APPWRITE_ENDPOINT`, `PUBLIC_APPWRITE_PROJECT_ID` i
  `PUBLIC_APPWRITE_PROJECT_NAME` z GitHub Environment `beta`;
- produkcyjny sentinel;
- `pnpm exec wrangler deploy --env beta`;
- smoke test beta;
- ponowny produkcyjny sentinel.

Workflow nie może zawierać `wrangler deploy` bez `--env beta`.

- [ ] **Step 2: Dodaj kontrolę statyczną workflow**

Create `scripts/validate-beta-workflow.mjs` sprawdzający, że
`.github/workflows/beta-deploy.yml`:

- zawiera `--env beta`;
- nie zawiera deployu bez środowiska;
- nie uruchamia się na `main`;
- używa GitHub Environment `beta`.

Dodaj skrypt:

```json
"check:beta-workflow": "node scripts/validate-beta-workflow.mjs"
```

Uruchamiaj go przed deployem w workflow.

- [ ] **Step 3: Commit**

```powershell
git add .github/workflows/beta-deploy.yml scripts/validate-beta-workflow.mjs package.json
git commit -m "ci(frontend): dodaj bezpieczny pipeline beta"
```

## Task 12: Przygotowanie Infrastruktury Beta

- [ ] **Step 1: DNS i route**

Utwórz proxied DNS dla `beta.chmura.blokserwis.pl`. Nie zmieniaj rekordu
`chmura.blokserwis.pl`.

- [ ] **Step 2: Appwrite**

W tym samym projekcie Appwrite dodaj beta platform/origin i dozwolone callbacki:

- `https://beta.chmura.blokserwis.pl/auth/callback`
- `https://beta.chmura.blokserwis.pl/login?failure=true`

Nie zmieniaj host-only cookie `__session` na cookie domenowe. Beta i stable
korzystają z tych samych kont, ale utrzymują osobne sesje przeglądarkowe.

- [ ] **Step 3: CORS storage**

Dodaj `https://beta.chmura.blokserwis.pl` do CORS bucketów R2/Appwrite
używanych przez bezpośrednie uploady. Nie usuwaj stable origin.

- [ ] **Step 4: Sekrety Workera beta**

Z bezpiecznego źródła ustaw dla `--env beta` te same wartości co stable:

```powershell
pnpm exec wrangler secret bulk .env.beta --env beta
pnpm exec wrangler secret list --env beta
```

`.env.beta` nie może zostać dodany do Git.

GitHub Environment `beta` musi dodatkowo udostępniać podczas builda:

- `PUBLIC_APPWRITE_ENDPOINT`
- `PUBLIC_APPWRITE_PROJECT_ID`
- `PUBLIC_APPWRITE_PROJECT_NAME`

Ustaw również `UPSTASH_REDIS_REST_URL`; bez niego hooks wyłączają lokalny
rate limiting aplikacji.

- [ ] **Step 5: UniSource preflight**

Potwierdź:

- `UNISOURCE_URL` wskazuje produkcyjny API;
- `UNISOURCE_SERVICE_ID` jest identyczny ze stable;
- API key ma wymagane uprawnienie `admin`;
- produkcyjny backend ma `CURSOR_HMAC_SECRET`;
- V2 endpointy odpowiadają na read-only request dedykowanego użytkownika.

## Task 13: Pełna Weryfikacja Przed Deploymentem

- [ ] **Step 1: Przywróć graf npm używany przez Cloudflare**

Run:

```powershell
pnpm sdk:unlink
pnpm install --frozen-lockfile
```

Expected: `node_modules/@unisource/sdk` jest przypiętym prerelease npm, nie
symlinkiem.

- [ ] **Step 2: Uruchom pełną weryfikację**

Run:

```powershell
pnpm check
pnpm lint
pnpm test:unit -- --run
pnpm build
pnpm check:beta-workflow
pnpm deploy:beta:dry
git status --short
```

Expected: wszystkie komendy PASS, brak nieoczekiwanych zmian.

- [ ] **Step 3: Produkcyjny sentinel**

Zweryfikuj bez mutacji:

- stable login page odpowiada;
- uwierzytelniony dedykowany użytkownik widzi listę plików;
- publiczny link testowy działa;
- brak wzrostu błędów stable.

Zapisz timestamp i wyniki w runbooku wdrożenia.

## Task 14: Deployment I Smoke Test Beta

- [ ] **Step 1: Wdróż wyłącznie beta**

Run:

```powershell
pnpm deploy:beta
```

Expected: Wrangler wskazuje Worker `chmura-blokserwis-beta` i beta route.

- [ ] **Step 2: Read-only smoke**

Sprawdź na beta:

- login/logout i OAuth callback;
- lista plików/folderów;
- breadcrumbs;
- kosz;
- preview użytkownika;
- main storage;
- admin users/settings;
- releases;
- publiczny share link.

- [ ] **Step 3: Controlled write smoke**

Dedykowanym użytkownikiem beta:

1. utwórz folder `beta-e2e-<timestamp>`;
2. upload małego pliku przez R2;
3. upload małego pliku przez Appwrite;
4. multipart upload kontrolnego pliku;
5. rename, move, share link, trash, restore i delete;
6. potwierdź widoczność zmian na stable;
7. usuń dane testowe.

- [ ] **Step 4: Produkcyjny sentinel po deployu**

Powtórz sentinel stable. Każdy regres stable oznacza natychmiastowy rollback
beta i przerwanie rollout.

## Task 15: Obserwacja, Rollback I Promocja

- [ ] **Step 1: Obserwuj beta przez minimum 7 dni**

Monitoruj:

- statusy 4xx/5xx i `UnisourceV2Error.code`;
- `requestId` w logach;
- błędy parserów SDK/Zod;
- błędy uploadu i multipart;
- rate limiting;
- stabilność produkcji.

- [ ] **Step 2: Przećwicz rollback beta**

Run:

```powershell
pnpm exec wrangler versions list --env beta
pnpm exec wrangler rollback --env beta
```

Alternatywnie wyłącz beta route. Potwierdź, że stable pozostaje dostępny.

- [ ] **Step 3: Zapisz runbook**

Create `docs/runbooks/unisource-v2-beta.md` z:

- wersją SDK i rewizją UniSource;
- wymaganymi sekretami bez wartości;
- komendami deploy/dry-run/rollback;
- smoke checklist;
- znanymi ograniczeniami;
- kryteriami promocji.

- [ ] **Step 4: Finalny commit gałęzi beta**

```powershell
git add docs/runbooks/unisource-v2-beta.md
git commit -m "docs(frontend): dodaj runbook migracji UniSource v2"
```

- [ ] **Step 5: Promocja do stable jako osobny etap**

Po akceptacji beta utwórz osobny PR do `main`. Przed wdrożeniem stable:

1. opublikuj stabilny patch SDK, planowany jako `1.1.1`, i przypnij go dokładnie;
2. ponownie uruchom pełną weryfikację;
3. potwierdź wersję SDK/API;
4. wykonaj stable sentinel;
5. wdrażaj wyłącznie zatwierdzoną rewizję;
6. zachowaj poprzednią wersję Workera do natychmiastowego rollbacku.

## Macierz Akceptacyjna

| Obszar              | Read |      Write | Cross-check stable | Wymagany wynik     |
| ------------------- | ---: | ---------: | -----------------: | ------------------ |
| Auth Appwrite       |  yes |    session |                yes | ten sam użytkownik |
| Files/folders       |  yes |        yes |                yes | te same rekordy    |
| Trash/restore       |  yes |        yes |                yes | zgodny stan        |
| Share links/public  |  yes |        yes |                yes | zgodny link        |
| R2 upload           |  yes |        yes |                yes | zgodny plik        |
| Appwrite upload     |  yes |        yes |                yes | zgodny plik        |
| Multipart           |  yes |        yes |                yes | kompletny plik     |
| Main storage        |  yes | controlled |                yes | zgodny stan        |
| Admin               |  yes | controlled |                yes | zgodne ustawienia  |
| Releases            |  yes | controlled |                yes | zgodny release     |
| Stable availability |  yes |        n/a |         continuous | zero downtime      |

## Warunki Natychmiastowego Rollbacku

- jakikolwiek błąd lub niedostępność stable powiązana czasowo z beta;
- parser SDK odrzuca poprawną odpowiedź produkcyjnego API;
- beta zapisuje rekordy poza wspólnym `UNISOURCE_SERVICE_ID`;
- auth beta wymaga innego projektu Appwrite;
- upload tworzy osierocone rekordy lub nie może zakończyć lifecycle;
- wzrost błędów 5xx, quota drift lub nieoczekiwany rate limiting;
- workflow próbuje wdrożyć Worker stable.
