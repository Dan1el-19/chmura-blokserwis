#!/bin/sh
set -eu

: "${E2E_BASE_URL:?Set the isolated frontend URL, for example http://localhost:3000}"
: "${PUBLIC_CLERK_PUBLISHABLE_KEY:?Set the Clerk development publishable key (pk_test_)}"
: "${CLERK_SECRET_KEY:?Set the Clerk development secret key (sk_test_)}"
: "${PUBLIC_CLOUD_API_URL:?Set the isolated backend URL, for example http://localhost:8787}"
: "${E2E_CLERK_USER_A_ID:?Set the exact dedicated Clerk user A ID}"
: "${E2E_CLERK_USER_B_ID:?Set the exact dedicated Clerk user B ID}"
: "${E2E_MULTIPART_SPACE_ID:?Set the isolated test space ID}"
: "${E2E_MULTIPART_FIXTURE_PATH:?Set a sparse file over 100,000,000 bytes}"
: "${E2E_MULTIPART_FIXTURE_BYTES:?Set the fixture exact byte count}"

if [ ! -f "$E2E_MULTIPART_FIXTURE_PATH" ]; then
	printf '%s\n' "Multipart fixture not found: $E2E_MULTIPART_FIXTURE_PATH" >&2
	exit 2
fi

fixture_size=$(wc -c < "$E2E_MULTIPART_FIXTURE_PATH" | tr -d ' ')
if [ "$fixture_size" != "$E2E_MULTIPART_FIXTURE_BYTES" ] || [ "$fixture_size" -le 100000000 ]; then
	printf '%s\n' "Fixture size must equal E2E_MULTIPART_FIXTURE_BYTES and exceed 100,000,000 bytes (actual: $fixture_size)." >&2
	exit 2
fi

export E2E_LIVE_MULTIPART=1
export E2E_EXTERNAL_APP=1

exec pnpm exec playwright test e2e/multipart-live.spec.ts --project=chromium "$@"
