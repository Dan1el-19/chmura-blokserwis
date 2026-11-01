# Frontend state and navigation

UniSource Cloud keeps its existing routes and backend contract. `chmura-blokserwis` is a
reference for presentation only; its Appwrite, multipart and public-link features are not
part of this change.

## Ownership

The root layout owns one `CloudState` instance and supplies it through Svelte context. It
contains session bootstrap, upload limits and permissions, catalogue caches, navigation
memory, upload preference and the transfer queue. No user state is held in a server module
singleton. A change of Clerk user or session invalidates this state immediately, before
token verification finishes. Late responses are rejected by session generations.

`StoragePage` owns transient dialogs and errors. `UploadManager` owns files, controllers
and the existing attempt-aware upload protocol. `UploadPanel` lives in the root layout, so
leaving a page never destroys a transfer. A persistent transfer shortcut in desktop/mobile
navigation can reopen the panel.

## Catalogue cache

Lists are keyed by view, space and parent folder. They retain loaded pages, cursor,
breadcrumb and container scroll position. Returning to a list displays cached data
immediately. Data older than 15 minutes is revalidated on entry, window focus, visibility
restoration or the minute timer while visible. Fresh lists do not generate requests. Only
an unvisited list shows a skeleton; route changes select their cache synchronously, so a
previous folder never renders as the new folder. Manual refresh forces revalidation.
Refreshing requests replay the loaded cursor chain and replace data atomically; failed
refreshes keep the previous list. Mutations invalidate affected lists and ancestor totals;
a restore into an unvisited parent conservatively invalidates the space because its
ancestry is unknown. Version checks prevent an older request from undoing a mutation.

Folder `size_bytes` values are recursive totals of active descendant files returned by
UniSourceCFL ListEntries/GetEntry. The backend calculates totals in one aggregate query
for the page, without browser traversal or additional RPC calls per folder. It excludes
trashed/deleting branches and other spaces. Deployment of this backend change is required
for folder sizes; an older backend leaves their size unknown. Nested mutations invalidate
cached ancestor listings too.

Mutation endpoints validate existence, access and revision atomically. A NotFound or
Aborted response refreshes the originating cached list; a failed operation is never
silently replayed against a newer revision.

The file and Main navigation links return to their last folders; folder URLs remain
authoritative for direct links and browser history. The selected trash space survives
route navigation within the session.

## Uploads and settings

Batches capture their space, parent folder and upload mode when enqueued. The queue is
sequential and accepts additional files during an active transfer. Individual cancellation
and whole-queue cancellation are separate operations. Terminal tasks release their File
and AbortController references. Successful statuses turn green and disappear after five
seconds. Errors remain until dismissed; dismissing finished statuses releases their
metadata. Changing a default affects future batches only. Upload success is independent of
catalogue-refresh success.

MD5 is required before creating a signed upload target. It is calculated in a dedicated
Web Worker in 2 MiB chunks, with preparation progress and cancellation, rather than
blocking the main UI thread. The actual signed transfer begins after checksum and target
creation.

The personal default is stored in localStorage under an account-specific key; files,
signed targets, session tokens and catalogue data are never persisted there. Auto remains
the initial default. All upload configuration lives at `/settings`, linked directly below
Trash in desktop and mobile navigation. Administrative settings remain protected by
backend permissions and revisions; unsaved drafts survive route navigation in memory.

Transfers survive in-app navigation and switching browser tabs while the page remains
alive. Reloading/closing the tab does not resume file bytes. A native before-unload prompt
warns while jobs remain. Browser/OS suspension can still interrupt background network
activity.

## Verification

- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.
- `pnpm test:e2e`: actual SvelteKit navigation and XHR in Chromium, Firefox and a mobile
  Chromium viewport, with controlled Clerk/RPC/storage fixtures.
- The browser scenario verifies 55 loaded entries, container scrolling, native dialog
  Escape/focus restoration, background-tab switching and an upload batch crossing
  Files/Main/Trash/Settings without destination or mode changes.
- CI installs Chromium and Firefox and runs the navigation suite. Production Clerk
  sessions and actual storage gateways require a separate integration smoke test;
  fixture-based browser tests do not establish production acceptance.
