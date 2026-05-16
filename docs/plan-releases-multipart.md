# Plan: Releases Multipart Upload — refactor do wzorca files/main

## Problem

Upload plików releases przez multipart kończy się błędem 500 na produkcji (Cloudflare Workers):
`ReferenceError: DOMParser is not defined` / `Node is not defined`

Przyczyną jest to, że endpointy `api/releases/multipart/*` wywołują `@aws-sdk/client-s3` bezpośrednio
(CreateMultipartUploadCommand, UploadPartCommand, itp.), a AWS SDK v3 używa `DOMParser` do parsowania
odpowiedzi XML z R2 — API niedostępnego w Cloudflare Workers.

Endpointy `api/upload/r2/multipart/*` (files/main) działają poprawnie, bo są czystym proxy do
unisource — backend nigdy nie dotyka AWS SDK, tylko deleguje do unisource który sam zarządza
multipart i zwraca presigned URLs.

## Zmiany do cofnięcia (cleanup)

Przed implementacją właściwego rozwiązania należy cofnąć tymczasowe hacki:

1. **`chmura-blokserwis/src/lib/clients/r2.ts`** — usunąć import `@xmldom/xmldom` i polyfill `DOMParser`
2. **`chmura-blokserwis/package.json`** — usunąć zależność `@xmldom/xmldom`
3. **`chmura-blokserwis/pnpm-lock.yaml`** — zaktualizować po usunięciu zależności (`pnpm install`)

## Docelowa architektura

```
Frontend (Uppy AwsS3)
  │
  ├─ POST /api/releases/multipart          → proxy → unisource POST /releases/upload/multipart/create
  ├─ GET  /api/releases/multipart/:id/:n   → proxy → unisource GET  /releases/upload/multipart/sign-part
  ├─ GET  /api/releases/multipart/:id      → proxy → unisource GET  /releases/upload/multipart/list-parts
  ├─ POST /api/releases/multipart/:id/complete → proxy → unisource POST /releases/upload/multipart/complete
  └─ DEL  /api/releases/multipart/:id      → proxy → unisource DEL  /releases/upload/multipart/abort
```

Backend chmura-blokserwis jest czystym proxy — zero AWS SDK, zero S3 calls.

## Kroki implementacji

### 1. UniSource backend (`apps/backend/src/routes/releases.ts`)

Dodać 5 nowych endpointów multipart dla releases, wzorując się na `upload.ts`:

- `POST /releases/upload/multipart/create` — inicjuje multipart upload dla release:
  - Wywołuje `releases.upload.init()` żeby zarezerwować release_id i r2_key
  - Wywołuje `r2.createMultipartUpload(r2_key, bucket)` żeby dostać r2_upload_id
  - Zapisuje w D1: release_id, r2_upload_id, r2_key, status=pending
  - Zwraca: `{ upload_id: release_id, r2_upload_id, key: r2_key, bucket }`

- `GET /releases/upload/multipart/sign-part?upload_id&part_number` — presigned URL dla partu:
  - Pobiera z D1 r2_upload_id i r2_key dla upload_id
  - Wywołuje `r2.signUploadPart(r2_key, r2_upload_id, part_number)`
  - Zwraca: `{ url, expires_at }`

- `GET /releases/upload/multipart/list-parts?upload_id` — lista wgranych partów (dla resume):
  - Pobiera z D1 r2_upload_id i r2_key
  - Wywołuje `r2.listParts(r2_key, r2_upload_id)`
  - Zwraca: `{ parts: [{ PartNumber, ETag, Size }] }`

- `POST /releases/upload/multipart/complete` — finalizuje upload:
  - Pobiera z D1 r2_upload_id, r2_key, release_id
  - Wywołuje `r2.completeMultipartUpload(r2_key, r2_upload_id, parts)`
  - Wywołuje `releases.upload.complete(release_id, size)` żeby oznaczyć release jako completed
  - Zwraca: `{ success: true, release_id, status: 'completed' }`

- `DELETE /releases/upload/multipart/abort` — przerywa upload:
  - Pobiera z D1 r2_upload_id, r2_key, release_id
  - Wywołuje `r2.abortMultipartUpload(r2_key, r2_upload_id)`
  - Wywołuje `releases.upload.fail(release_id)`
  - Zwraca: `{ success: true, release_id, status: 'failed' }`

**Uwaga:** Unisource backend ma już `r2.ts` z metodami multipart (`createMultipartUpload`,
`signUploadPart`, `listParts`, `completeMultipartUpload`, `abortMultipartUpload`) — używa ich
dla zwykłych plików. Releases używają tego samego bucketu (`CHMURA_BLOKSERWIS_BUCKET`).

Potrzebna będzie tabela/kolumna w D1 do przechowywania `r2_upload_id` dla pending releases
(lub można to przechowywać w istniejącej tabeli releases jako dodatkowe pole).

### 2. UniSource SDK (`packages/unisource-sdk/src/releases.ts` + `client.ts`)

Dodać typy i metody do SDK:

```ts
// releases.ts — nowe typy
export const releaseMultipartCreateResponseSchema = z.object({
	upload_id: nonEmptyString, // = release_id
	r2_upload_id: nonEmptyString,
	key: nonEmptyString,
	bucket: nonEmptyString,
	expires_at: positiveInt
});

export const releaseMultipartSignPartResponseSchema = z.object({
	url: z.string().url(),
	expires_at: positiveInt
});

// ... list-parts, complete, abort analogicznie do uploads.ts
```

```ts
// client.ts — w releases.upload
multipart: {
  create: (body: ReleaseMultipartCreateRequest) => ...,
  signPart: (uploadId: string, partNumber: number) => ...,
  listParts: (uploadId: string) => ...,
  complete: (body: ReleaseMultipartCompleteRequest) => ...,
  abort: (uploadId: string) => ...,
}
```

Zbuildować SDK: `pnpm --filter @unisource/sdk build`

### 3. chmura-blokserwis — refactor proxy endpoints

Zastąpić zawartość wszystkich 5 plików w `src/routes/api/releases/multipart/`:

**`+server.ts` (POST — create):**

```ts
// Zamiast CreateMultipartUploadCommand:
const init = await client.releases.upload.multipart.create({ ... });
return json({ key: init.key, uploadId: init.r2_upload_id, release_id: init.upload_id });
```

**`[uploadId]/+server.ts` (GET list-parts, DELETE abort):**

```ts
// GET: client.releases.upload.multipart.listParts(uploadId)
// DELETE: client.releases.upload.multipart.abort(uploadId)
```

**`[uploadId]/[partNumber]/+server.ts` (GET sign-part):**

```ts
// client.releases.upload.multipart.signPart(uploadId, partNumber)
```

**`[uploadId]/complete/+server.ts` (POST complete):**

```ts
// client.releases.upload.multipart.complete({ upload_id, parts })
// Nie trzeba już osobno wywoływać /api/releases/complete — unisource robi to wewnętrznie
```

Zaktualizować `release-upload.svelte.ts` jeśli zmieni się format odpowiedzi `completeMultipartUpload`.

### 4. Aktualizacja zależności w chmura-blokserwis

```bash
pnpm sdk:unlink   # upewnij się że używasz npm package
pnpm install --frozen-lockfile
```

Lub jeśli SDK jest linkowane lokalnie:

```bash
pnpm sdk:link
pnpm dev
```

### 5. Deploy

```bash
# W UniSource:
pnpm --filter @unisource/backend deploy

# W chmura-blokserwis:
pnpm run deploy
```

## Kolejność pracy

1. Cleanup (cofnięcie hacków) w chmura-blokserwis
2. Unisource backend — nowe endpointy releases multipart
3. Unisource SDK — nowe typy i metody
4. chmura-blokserwis — refactor proxy endpoints
5. Deploy unisource backend
6. Aktualizacja SDK w chmura-blokserwis + deploy
