# Analiza migracji: Effinity Cloud → UniSource + Cloudflare Workers

## TL;DR

UniSource zastępuje ok. **65% aktualnego backendu**. Pozostałe 35% (releases, ZIP download, auth, external config) wymaga własnych Cloudflare Workers lub pozostaje w SvelteKit z adapterem CF.

---

## Co UniSource ZASTĘPUJE (może być wycięte z backendu)

### Pliki i foldery

| Funkcja w Effinity  | Endpoint UniSource                           | Uwagi                                    |
| ------------------- | -------------------------------------------- | ---------------------------------------- |
| Lista plików        | `GET /my-files`                              | Zmiana: cursor pagination zamiast offset |
| Metadane pliku      | `GET /my-files/:id`                          | 1:1                                      |
| Rename/move pliku   | `PATCH /my-files/:id` + `/my-files/:id/move` | Rozdzielone na 2 endpointy               |
| Usunięcie pliku     | `DELETE /my-files/:id`                       | UniSource dodaje soft-delete (kosz)      |
| URL do pobrania     | `GET /my-files/:id/download-url`             | 1:1                                      |
| Lista folderów      | `GET /folders`                               | 1:1                                      |
| Tworzenie folderu   | `POST /folders`                              | Dodatkowe: `color_tag`                   |
| Rename/move folderu | `PATCH /folders/:id`                         | 1:1                                      |
| Usunięcie folderu   | `DELETE /folders/:id`                        | UniSource: recursive delete SQL CTE      |

### Upload plików

| Funkcja w Effinity       | Endpoint UniSource           | Uwagi                                                                  |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| Uppy multipart init      | `POST /upload/r2/init`       | **Zmiana architektury** — presigned URL zamiast multipart przez serwer |
| Presigned URL dla części | `GET /uppy/sign`             | Zastąpione przez init flow                                             |
| Kompletowanie uploadu    | `POST /upload/complete`      | 1:1 logika                                                             |
| Weryfikacja quota        | Wbudowane w `/upload/*/init` | 409 przy przekroczeniu                                                 |

> **Ważna zmiana**: Aktualny flow to Uppy S3-multipart przez server jako proxy. UniSource używa presigned URL — klient uploaduje bezpośrednio do R2. Uppy obsługuje to przez plugin `@uppy/aws-s3` z `shouldUseMultipart: false` lub przez własny presigned URL plugin.

### Share linki

| Funkcja w Effinity | Endpoint UniSource                   | Uwagi                              |
| ------------------ | ------------------------------------ | ---------------------------------- |
| Utwórz share link  | `POST /my-files/:fileId/share-links` | Brak: folder shares, shareType=zip |
| Lista share linków | `GET /my-files/:fileId/share-links`  | 1:1                                |
| Edycja linku       | `PATCH /share-links/:linkId`         | Brak: auto-delete flag             |
| Usuń link          | `DELETE /share-links/:linkId`        | 1:1                                |
| Publiczny dostęp   | `GET /public/:slug`                  | 1:1                                |
| Unlock hasłem      | `POST /public/:slug/unlock`          | 1:1                                |
| Pobranie pliku     | `GET /public/:slug/download`         | 1:1                                |

### Admin: użytkownicy

| Funkcja w Effinity | Endpoint UniSource                           | Uwagi                            |
| ------------------ | -------------------------------------------- | -------------------------------- |
| Lista użytkowników | `GET /admin/users`                           | 1:1                              |
| Zmiana roli        | `PATCH /admin/users/:id` (labels)            | Inne pole: `role` zamiast labels |
| Reset hasła        | `POST /admin/users/:id/password`             | 1:1                              |
| Limit storage      | `PATCH /admin/users/:id` (max_storage_bytes) | 1:1                              |

---

## Co NIE ISTNIEJE w UniSource (wymaga własnego kodu)

### 1. Releases management — kompletnie brak w UniSource

Cały system wydań aplikacji (`/api/releases/*`, `/api/releases/multipart/*`) jest specyficzny dla Effinity Cloud:

- Multipart upload z kluczem `releases/{filename}` w R2
- Tagi, notatki, `forceUpdate` flag
- Tag shifting (`latest`)
- Sync z zewnętrznym Appwrite — `externalConfig.ts` (Firebase-like config)

**Rozwiązanie**: Osobny Cloudflare Worker lub SvelteKit route z `@sveltejs/adapter-cloudflare`.

### 2. Pobieranie folderu jako ZIP — brak w UniSource

`GET /api/folders/:folderId/download` — rekurencyjne archiwum ZIP (do 10GB) generowane przez `archiver`. UniSource nie ma odpowiednika.

**Problem przy migracji do CF Workers**: Workers mają limit 128MB na response body (streaming). Potrzebny będzie inny mechanizm (np. generowanie ZIP po stronie klienta lub przez Durable Object).

### 3. Autentykacja — UniSource zakłada gotowe JWT

UniSource nie dostarcza: logowania, wylogowania, OAuth (GitHub/Google), tworzenia sesji. Wymaga gotowego JWT z zewnętrznego systemu auth.

Aktualnie używasz Appwrite Auth — to zostaje w SvelteKit. UniSource akceptuje JWT z Appwrite.

### 4. MAIN_STORAGE (shared storage) — brak konceptu w UniSource

Koncept `MAIN_STORAGE_OWNER_ID` (pliki/foldery jednego użytkownika dostępne dla wszystkich `plus`/`admin`) nie istnieje w UniSource. Multi-tenancy UniSource działa przez `X-Service-ID`, nie przez role-based shared ownership.

**Rozwiązanie**: Albo przeprojektować tę funkcję, albo obsłużyć przez własną warstwę.

### 5. Admin statystyki — częściowo

UniSource ma `GET /admin/service/usage` (storage % per service) i `GET /admin/audit-log`. Brakuje:

- Per-user storage breakdown na dashboardzie
- Rozkład użytkowników per rola

---

## Plan migracji do Cloudflare Workers

### Architektura docelowa

```
Browser
  │
  ├── SvelteKit Frontend (adapter-cloudflare)
  │     ├── Auth flows (login/logout/OAuth) → Appwrite
  │     ├── Releases pages → CF Worker (releases)
  │     └── Admin/user pages → UniSource SDK
  │
  ├── UniSource API (zewnętrzny)
  │     ├── /my-files/*
  │     ├── /folders/*
  │     ├── /upload/*
  │     ├── /share-links/*
  │     ├── /public/*
  │     └── /admin/*
  │
  └── CF Worker: Releases
        ├── Multipart upload do R2
        ├── CRUD metadanych (D1 lub Appwrite Tables)
        └── External config sync
```

### Kroki migracji

**Krok 1 — Swap adaptera (bezpieczny)**

```
@sveltejs/adapter-node → @sveltejs/adapter-cloudflare
```

Wymaga: zmiana `R2_*` env na CF bindings, Upstash Redis → CF KV lub CF Rate Limiting API.

**Krok 2 — Replace upload flow**

- Wyciąć `/api/uppy/multipart/*` i `/api/uppy/sign`
- Zamienić Uppy plugin na `@uppy/aws-s3` z presigned URL z UniSource SDK
- Frontend woła `client.upload.r2Init()` → dostaje presigned URL → uploaduje bezpośrednio

**Krok 3 — Replace pliki/foldery**

- Wyciąć `/api/files/*`, `/api/folders/*` (bez ZIP download)
- Zamienić na `client.myFiles.*` i `client.folders.*`
- **Uwaga**: zmiana z offset na cursor pagination — trzeba dostosować UI

**Krok 4 — Replace shares**

- Wyciąć `/api/shares/*`, `/routes/file/[slug]`
- Zamienić na `client.shareLinks.*` + `getPublicFileInfo()`
- **Ograniczenie**: stracisz folder shares i ZIP shares — trzeba zdecydować czy przeprojektować

**Krok 5 — Replace admin users**

- Wyciąć `/api/admin/users/*`
- Zamienić na `client.admin.*`

**Krok 6 — Napisać CF Worker dla Releases**

- Przenieść logikę z `/api/releases/*` do Hono Worker
- Użyć D1 zamiast Appwrite Tables (lub zostać przy Appwrite)
- Przenieść `externalConfig.ts` sync logikę

**Krok 7 — ZIP download**

- Opcja A: przenieść do CF Worker z TransformStream + `archiver` (wymaga testów limitu)
- Opcja B: generować po stronie klienta (`JSZip`) dla folderów < 1GB
- Opcja C: osobny serwis lub Workers for Platforms

---

## Podsumowanie: Co wyciąć vs. zostawić

| Moduł                            | Decyzja                            | Zamiennik                                |
| -------------------------------- | ---------------------------------- | ---------------------------------------- |
| `/api/uppy/*`                    | **WYCIĄĆ**                         | UniSource upload flow                    |
| `/api/files/*`                   | **WYCIĄĆ**                         | UniSource `/my-files/*`                  |
| `/api/folders/*` (bez ZIP)       | **WYCIĄĆ**                         | UniSource `/folders/*`                   |
| `/api/shares/*` + `/file/[slug]` | **WYCIĄĆ** (częściowo)             | UniSource `/share-links/*` + `/public/*` |
| `/api/admin/users/*`             | **WYCIĄĆ**                         | UniSource `/admin/users/*`               |
| `/api/releases/*`                | **ZOSTAJE** → CF Worker            | Własny Hono Worker                       |
| `/api/folders/*/download` (ZIP)  | **ZOSTAJE** → do przeprojektowania | Nowe podejście                           |
| Auth flows                       | **ZOSTAJE**                        | Appwrite Auth (niezmienione)             |
| `externalConfig.ts`              | **ZOSTAJE** → w releases worker    | Przeniesione                             |
| `src/lib/server/storage/*.ts`    | **WYCIĄĆ**                         | UniSource SDK                            |
| `rate-limit.ts` (Upstash)        | **WYCIĄĆ**                         | CF native rate limiting                  |
| `cache/` (tiny-lru)              | **WYCIĄĆ**                         | UniSource cachuje wewnętrznie            |
| `roles.ts`                       | **ZOSTAJE** (częściowo)            | Adapter dla UniSource user role          |

---

## Główne ryzyka

1. **ZIP download przez CF Workers** — limit 128MB na response body; potrzebny test z dużymi folderami
2. **Cursor pagination** — zmiana z offset na cursor w UI (pliki/foldery)
3. **Folder/ZIP shares** — UniSource obsługuje tylko file shares; folder sharing wymaga przeprojektowania
4. **MAIN_STORAGE** — brak odpowiednika w UniSource; shared storage dla plus/admin musi być obsłużony inaczej
5. **Migracja danych** — Appwrite Tables → D1 (jeśli przenosisz releases worker na D1)
