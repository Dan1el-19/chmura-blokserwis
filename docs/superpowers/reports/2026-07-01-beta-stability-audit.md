# Raport stabilności bety UniSource v2

> Ostatnia aktualizacja: 2026-07-03
> Zakres: `A:\Projects\chmura-blokserwis` (`codex/unisource-v2-beta`) oraz `A:\Projects\UniSource` (`beta`)
> Cel: potwierdzić gotowość bety Chmury z UniSource v2 do promocji na stable.

## Decyzja

Beta została wdrożona, przetestowana i wypromowana na stable na bazie aktualnego `origin/main`.

Nie ma już lokalnego blokera w Chmurze:

- `@unisource/sdk` jest przypięty do opublikowanego `1.1.3`, nie do `file:../UniSource`.
- `pnpm check` przechodzi bez błędów i bez warningów Svelte.
- Unit, build beta i Playwright smoke E2E przechodzą lokalnie.
- Kontrakty UniSource v2 używane przez Chmurę mają pokrycie w opublikowanym SDK `1.1.3`.
- Beta i stable odpowiadają poprawnie na publicznym smoke teście unauthenticated.
- GitHub Actions `Deploy stable` wykonał realny deploy i smoke produkcji po uzupełnieniu sekretów Cloudflare/GitHub.

## Zweryfikowane bramki

| Bramka                    | Wynik | Uwagi                                                                                     |
| ------------------------- | ----: | ----------------------------------------------------------------------------------------- |
| `pnpm check`              |    OK | 0 errors, 0 warnings po wyciszeniu uzasadnionych user-uploaded video captions             |
| `pnpm lint`               |    OK | 0 errors; ESLint raportuje 91 warnings w istniejących obszarach scripts/skeletons         |
| `pnpm test:unit -- --run` |    OK | 235 testów, 57 plików                                                                     |
| `pnpm build:beta`         |    OK | `check:beta-config` przeszedł; PWA generuje `.svelte-kit/output/client/service-worker.js` |
| `pnpm test:e2e`           |    OK | 3 smoke testy Playwright po buildzie i `vite preview`                                     |
| `pnpm deploy:beta:dry`    |    OK | Wrangler dry-run dla `env beta` przechodzi, bez publikacji                                |
| Stable dry-run            |    OK | `wrangler deploy --dry-run` dla top-level stable env czyta 80 assetów                     |
| GitHub Actions beta       |    OK | `Deploy beta` po pushu przeszedł deploy, smoke beta i kontrolę stable po deployu          |
| GitHub Actions stable     |    OK | `Deploy stable` run `28625073040`: check, unit, build, deploy i smoke stable              |
| Live smoke beta           |    OK | `/`, `/login`, `/service-worker.js`, `/registerSW.js`, `/manifest.webmanifest` -> 200     |
| Live smoke stable         |    OK | `/`, `/login`, `/service-worker.js`, `/registerSW.js`, `/manifest.webmanifest` -> 200     |
| SDK npm                   |    OK | `@unisource/sdk@1.1.3` zawiera `uploadFail`, `r2_used_bytes`, `appwrite_used_bytes`       |

## Zamknięte blokery

| #   | Problem                                           | Zamknięcie                                                                       |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Rozjazd ścieżek `/v2/*`                           | UniSource beta ma merge `origin/main -> beta` z route split i routingiem v2.     |
| 2   | Brak `preview-url` dla main storage               | UniSource beta ma endpoint `GET /v2/main/:id/preview-url`.                       |
| 3   | Brak defense-in-depth na releases                 | Chmura ma admin-checki w handlerach releases.                                    |
| 4   | Błędy typów `r2_used_bytes`/`appwrite_used_bytes` | SDK `1.1.3` i Chmura są zgodne; `pnpm check` przechodzi.                         |
| 5   | `client.upload.uploadFail`                        | SDK `1.1.3` eksportuje `upload.uploadFail()`.                                    |
| 6   | Lokalny `file:` link SDK                          | Chmura używa opublikowanego `@unisource/sdk@1.1.3`.                              |
| 7   | Brak E2E                                          | Dodany `e2e/smoke.spec.ts`; `pnpm test:e2e` przechodzi.                          |
| 8   | Service Worker 404 / konflikt PWA                 | Worker PWA jest budowany jako `service-worker.js` i zawiera obsługę Uppy resume. |
| 9   | Brak CSP i słaby fallback rate limitu             | Dodano CSP i in-memory fallback limiter.                                         |
| 10  | Duży chunk ikon                                   | Dodano `sveltePhosphorOptimize()`; największy client chunk spadł do ok. 275 kB.  |
| 11  | Stable deploy pomijany lub bez `wrangler` w PATH  | Uzupełniono GitHub `production` secrets i uruchamianie `pnpm exec wrangler deploy`. |

## Różnice beta vs stable

### Chmura

- Migracja integracji na UniSource v2.
- Podgląd mediów i publicznych linków: obrazy, audio, video, URL podglądu/pobrania.
- Rozszerzone wskaźniki użycia storage w adminie: R2/Appwrite.
- Twardsze zabezpieczenia endpointów releases/upload: role admin, Zod validation, mniej wycieków `error.message`.
- Osobny workflow deploy beta i workflow deploy stable.
- Smoke E2E dla unauthenticated flow.

### UniSource

- Beta zawiera merge `origin/main -> beta` z V2 route split, API access keys i storage usage split.
- Dodany endpoint preview URL dla main storage.
- Moduł Fakturownia/GPT pozostaje odizolowany od ruchu Chmury.
- SDK `1.1.3` zawiera wymagany kontrakt Chmury: `uploadFail`, usage split, v2 envelopes.

## Ryzyka operacyjne

- Build PWA nadal pokazuje nieblokujący warning Workboxa o pustym globie `prerendered/**/*.{html,json}`; aplikacja nie prerenderuje stron, a build, E2E i dry-run deploy przechodzą.
- UniSource worktree ma lokalne, niezamknięte zmiany w skryptach Fakturowni oraz jeden dirty diff w SDK. Nie są wymagane przez Chmurę po przejściu na npm SDK `1.1.3`; nie powinny trafić przypadkiem do commita promocyjnego.

## Status promocji

Promocja stable jest zamknięta:

1. Commit promocyjny został wypchnięty do `main`.
2. GitHub `production` secrets zawierają komplet wymagany przez `Deploy stable`.
3. `Deploy stable` run `28625073040` przeszedł z realnym `Build`, `Deploy stable` i `Smoke test stable`.
4. Niezależny smoke produkcji po deployu potwierdził `200` dla `/`, `/login`, `/service-worker.js`, `/registerSW.js` i `/manifest.webmanifest`.
