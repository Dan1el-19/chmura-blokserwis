# Domena UniSource ID

Worker obsługuje `auth.blokserwis.pl`, domenę RP skonfigurowaną w produkcyjnym Clerk. Plik `/.well-known/webauthn` dopuszcza wyłącznie Chmurę jako powiązany origin WebAuthn. Przeglądarka i Clerk niezależnie weryfikują żądanie; sama obecność pliku nie potwierdza udanego logowania.

Główna ścieżka przekierowuje do Chmury, ponieważ Clerk używa tej domeny jako domyślnego adresu po logowaniu. Parametry zapytania nie są przekazywane. Pozostałe ścieżki zwracają 404. Worker nie obsługuje `accounts.auth.blokserwis.pl` ani `clerk.auth.blokserwis.pl`.

Sprawdzenie i wdrożenie:

```sh
node --test workers/auth-domain/index.test.mjs
pnpm exec wrangler deploy --config workers/auth-domain/wrangler.jsonc --dry-run
pnpm exec wrangler deploy --config workers/auth-domain/wrangler.jsonc
```

To osobny Worker i nie jest wdrażany przez standardowy build Chmury.
