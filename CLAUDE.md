# CLAUDE.md

Frontend-only guidance for this SvelteKit app.

## Commands

```bash
pnpm dev
pnpm check
pnpm lint
pnpm format
pnpm test:unit
pnpm test:e2e
pnpm build
```

Single test:

```bash
pnpm test:unit -- src/path/file.spec.ts
```

## Stack

* SvelteKit + Svelte 5
* TypeScript
* Cloudflare adapter
* Vitest
* Playwright
* Prettier + ESLint

## Frontend rules

* Work only in frontend files unless explicitly asked otherwise.
* Prefer existing components, styles, tokens and patterns.
* Keep components small and reusable.
* Preserve current behaviour and accessibility.
* Use semantic HTML.
* Support keyboard navigation and visible focus states.
* Keep responsive behaviour intact.
* Avoid new dependencies unless necessary.
* Do not inspect server code, infrastructure or external repositories unless required.
* Do not run full test suites unless requested.
* For scoped UI work, read only directly relevant files.

## Testing

* Svelte component tests: `src/**/*.svelte.{test,spec}.{js,ts}`
* Browser tests use Playwright/Chromium.
* Run `pnpm check` after frontend changes.
