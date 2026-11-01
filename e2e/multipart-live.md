# Live multipart acceptance

`multipart.spec.ts` is the browser wire suite with in-process RPC and data-plane handlers. `multipart-live.spec.ts` is separate: it uses actual Clerk development tickets, the actual frontend/API, and the configured isolated R2 and RustFS receivers. Do not point it at production services or production storage.

## Required environment

| Variable | Purpose |
| --- | --- |
| `E2E_BASE_URL` | The already-running isolated frontend. The current setup uses `http://localhost:3000`. |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk development instance key (`pk_test_`) used by that frontend. |
| `CLERK_SECRET_KEY` | Clerk development backend key (`sk_test_`). It is read only by the Playwright Node process to validate users, issue one-use tickets and revoke sessions. |
| `PUBLIC_CLOUD_API_URL` | Isolated API origin; the live setup uses `http://localhost:8787`. |
| `E2E_CLERK_USER_A_ID`, `E2E_CLERK_USER_B_ID` | Exact, distinct, existing Clerk development user IDs. User A runs the R2 resume scenario; user B runs the RustFS scenario. Both must be allowed to use the test space and change its storage preference. |
| `E2E_MULTIPART_SPACE_ID` | Pre-created isolated test space accessible to both users. |
| `E2E_MULTIPART_FIXTURE_PATH` | A local sparse file, initially around 101 MB. The spec hard-links it into its own temporary directory and removes only that temporary link after the run. |
| `E2E_MULTIPART_FIXTURE_BYTES` | Exact fixture length in bytes. The launcher and spec both compare it to the file. |
| `E2E_MULTIPART_CLEANUP_MANIFEST` | Optional new output path for the local JSON cleanup manifest. The default is a unique file under `.cache/`. Existing files are never overwritten. |
| `E2E_MULTIPART_TEST_TIMEOUT_MS` | Optional Playwright test timeout; defaults to 900,000 ms. |
| `E2E_MULTIPART_UPLOAD_TIMEOUT_MS` | Optional upload and full-download timeout; defaults to 120,000 ms for the bounded fixture and 7,200,000 ms for fixtures at least 1 GB. |
| `E2E_MULTIPART_EXPECTED_SHA256` | Optional expected full-file SHA-256. Required for the exact 10 GB acceptance so downloaded bytes are checked against the approved fixture digest. |
| `E2E_MULTIPART_10GB_APPROVED` | Must be `1` to run the exact 10 GB live fixture; this keeps large object-store IO behind an explicit budget gate. |
| `E2E_MULTIPART_GATEWAY_RESTART_HOOK` | Optional absolute path to the isolated backend's guarded gateway restart hook. Accepted only by the exact 10 GB R2 restart case, after two actual receipts and browser shutdown. |
| `E2E_HEADLESS` | Set to `0` to show the browser. |

The isolated backend must enable multipart creation only for the two listed user IDs, advertise the configured multipart limits, and point D1, R2, RustFS and the gateway at disposable test resources. In the current isolated setup the frontend is on port 3000, API on 8787, and gateway on 9095. The API must advertise a 10 GB per-file maximum and a 100 GB isolated-account quota. The browser flow explicitly opens `Main` before selecting a provider and uploads there; `BeginMultipartUpload.spaceId` must equal `E2E_MULTIPART_SPACE_ID`. Keep provider credentials and bindings in the backend's isolated environment configuration; do not change the production configuration for this test.

The cleanup manifest is created mode `0600` before browser activity. It records the validated user IDs, Clerk ticket IDs, active session IDs, request/upload/entry IDs and provider. It records `testOutcome` separately from `cleanupStatus`; a run with clean resource cleanup still remains failed if Playwright failed or was interrupted. It never records Clerk ticket tokens, JWTs, signed URLs or file bytes. While the browser session is active, the spec cancels and re-queries incomplete multipart sessions. For completed uploads it trashes the entry if needed, permanently deletes it, then verifies it is absent from both the active catalog and trash list. `afterAll` revokes recorded Clerk tickets/sessions and preserves the manifest for review. A failed cleanup is a test failure and leaves the manifest with the error details; it does not silently delete backend evidence.

## Bounded run

Start the isolated frontend with the test publishable key and `PUBLIC_CLOUD_API_URL` set to the isolated service. Then export the variables above from a local secret manager or shell and run:

```sh
./scripts/run-live-multipart-e2e.sh
```

The launcher requires both test keys, the exact user IDs and fixture length, forces the live spec on, and runs only Chromium against the already-running frontend. It passes optional Playwright arguments through; append `--grep 'manual R2 resumes only unconfirmed parts after a real browser restart and rejects a different file'` or `--grep 'manual RustFS upload completes through the live gateway and backend API'` to run exactly one provider case with its own manifest. With a roughly 101 MB fixture, the spec selects shared `Main` in the UI and asserts `BeginMultipartUpload.spaceId` equals the configured space, uploads through the real API and gateway, pauses after parts 1–2 have actual confirmed receipts while requests for later targets are held before reaching the backend, then closes/reopens Chromium with the same isolated browser profile. It rejects a same-named, same-size, same-modification-time wrong-content file without requesting any new part target, reselects the original file, and verifies the resulting catalog entry. It then uploads a separate file to manual RustFS as user B and verifies its actual provider in multipart part-target responses. Each completed test entry is permanently deleted after the UI assertion, and the manifest records the IDs and cleanup verification state.

This bounded run verifies the browser-to-real-service protocol path and restarts the browser while parts 1–2 have actual confirmed receipts and target requests for parts 3–4 are held before reaching the backend. On resume it asserts that already-confirmed parts receive no new target request or PUT, and that the file finishes from missing parts only. The wrong-file control has the same basename and exact byte length as the source fixture, with one content byte changed; it must be rejected before any new target RPC. The held requests do not create backend leases or receipts. It does not establish 10 GB capacity, interruption after a provider has begun storing a part, cleanup of underlying provider objects, or backend Auto fallback. Run a separate capacity acceptance with an exact 10,000,000,000-byte fixture only after the bounded run and the isolated backend owner approve that gate. For that run set `E2E_MULTIPART_FIXTURE_BYTES=10000000000` and point `E2E_MULTIPART_FIXTURE_PATH` at the corresponding sparse fixture.

The exact 10 GB case also requires `E2E_MULTIPART_10GB_APPROVED=1` and `E2E_MULTIPART_EXPECTED_SHA256`. Set `E2E_MULTIPART_TEST_TIMEOUT_MS=10800000` and `E2E_MULTIPART_UPLOAD_TIMEOUT_MS=7200000` for the three-hour test and two-hour transfer windows. The spec streams the published object directly into SHA-256 and MD5 hashers with bounded memory, checks exact byte count, compares SHA-256 with the supplied fixture digest and MD5 with the committed catalog entry, and records only byte count and digests. During large runs it samples aggregate RSS for processes whose command line contains that run's owned temporary browser profile path; the manifest records peak RSS in KiB, not raw process arguments or signed URLs. The 10 GB R2 case uses the same true restart after parts 1–2 are confirmed, then checks that resume uploads only missing parts. Do not set the approval variable until the isolated backend and object-store IO budget are ready.
