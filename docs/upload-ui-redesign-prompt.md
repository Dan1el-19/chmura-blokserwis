# Prompt: Redesign UI/UX sekcji uploadu (chmura-blokserwis)

Pracuj wyłącznie w repozytorium `A:\Projects\chmura-blokserwis`. Nie ruszaj `A:\Projects\UniSource`. Po zakończeniu prac nie commituj, nie pushuj i nie rób PR — pokaż mi tylko listę zmienionych plików i krótkie podsumowanie.

## Zakres — tylko te pliki

Komponenty (`src/lib/components/upload/`):
- `DropZone.svelte` — strefa drag & drop (desktop)
- `UppyZone.svelte` — opakowanie Uppy, integracja z pipeline
- `UploadSplitButton.svelte` — split button z wyborem źródła plików
- `UploadProgressList.svelte` — lista aktywnych postępów uploadu
- `MobileStartUploadFAB.svelte` — FAB uruchamiający upload na mobile

Moduły stanu (`src/lib/modules/`):
- `upload.svelte.ts` — logika uploadu, kolejka, statusy
- `upload-progress.spec.ts` — testy (nie modyfikuj logiki, chyba że redesign wymaga zmian w API stanu)

Powiązane (dotykaj tylko jeśli redesign tego wymaga):
- `src/lib/components/releases/ReleaseUploadModal.svelte`

Poza powyższymi plikami nic nie zmieniaj.

## Co masz zrobić

Przeprowadź audyt i redesign UI/UX sekcji uploadu z naciskiem na:

1. **Spójność wizualna** z resztą aplikacji (design tokens, typografia, spacing, kolory — sprawdź `src/app.css` i istniejące komponenty w `src/lib/components/`).
2. **Feedback stanów**: idle / hover / drag-over / uploading / success / error / paused — każdy musi być wyraźny i spójny.
3. **Mobile-first**: `MobileStartUploadFAB`, `DropZone` i `UploadProgressList` muszą działać poprawnie na małych ekranach (dotyk, gesty, viewport).
4. **Dostępność (a11y)**: focus states, ARIA, klawiatura, kontrast, `prefers-reduced-motion`.
5. **Wydajność percepcyjna**: optymistyczne UI, animacje postępu, nieblokujące interakcje.
6. **Zachowanie obecnej funkcjonalności**: nie łam istniejącego API modułu `upload.svelte.ts` ani integracji z Uppy, chyba że redesign tego wymaga (wtedy zgłoś to w podsumowaniu).
7. **Testy wizualne/regresyjne**: uruchom `pnpm test` (lub odpowiednik) i `pnpm check` po zmianach; napraw tylko to, co sam zepsułeś.

## Ograniczenia

- Pracuj w izolacji: nie refaktoruj komponentów spoza listy „Zakres", nawet jeśli wyglądają kusząco.
- Nie dodawaj nowych zależności bez wyraźnego powodu UX. Jeśli chcesz coś dodać, uzasadnij w podsumowaniu.
- Nie ruszaj pipeline CI/CD, wersjonowania, release-ów.
- Jeśli natkniesz się na sprzeczność (np. redesign wymaga zmiany `upload.svelte.ts` lub `ReleaseUploadModal.svelte`) — zatrzymaj się i opisz to w podsumowaniu zamiast działać poza zakresem.
- Repo `A:\Projects\UniSource` traktuj jako read-only. Brakujące kontrakty SDK/API zgłaszaj, nie obchodź.

## Sposób pracy

1. Najpierw przeczytaj wszystkie pliki z sekcji „Zakres", żeby zrozumieć obecny stan.
2. Zrób krótki audyt (2–5 punktów) co jest źle/średnio/dobrze.
3. Zaplanuj zmiany w obrębie wskazanych plików.
4. Wprowadź zmiany małymi, czytelnymi krokami.
5. Na końcu uruchom testy i `svelte-check` / typecheck, popraw tylko własne regresje.
6. Zwróć mi: listę zmienionych plików + 5–10 punktów co się zmieniło + ewentualne ryzyka poza zakresem.
