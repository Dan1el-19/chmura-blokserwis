# Backend API snapshot

These protobuf definitions are a pinned client-side snapshot of UniSourceCFL's
public ConnectRPC contract. The snapshot was verified against UniSourceCFL
commit `a4fe2c6` on 2026-10-28. This includes storage settings, storage
locations, Auto selection, and attempt-aware upload fallback (storage
migrations through `0010`).

Update it deliberately when the backend contract changes, then regenerate
`src/lib/gen` with `pnpm proto:generate`. Run `pnpm proto:check` to validate
the generated client and `pnpm proto:check:backend /path/to/UniSourceCFL`
to compare the full snapshot with a backend checkout. CI validates local
generation; backend comparison requires access to the separate private repo.
