<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { create } from '@bufbuild/protobuf';
	import { Code, ConnectError } from '@connectrpc/connect';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getQuoteClient } from '#lib/api.js';
	import {
		QuoteDraftSchema, QuoteImportMappingSchema, QuotePriceMode, QuoteDescriptionStandard,
		type Quote, type QuoteDraft, type QuoteLine, type QuoteImportResult,
		type QuoteRevisionInfo, type GetQuoteOperationResponse, type GetQuotePdfResponse
	} from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field, isMissing, panel, primary, quoteError, shouldPollQuote } from './ui.js';
	import QuoteLines from './QuoteLines.svelte';
	import QuoteAiActivity from './QuoteAiActivity.svelte';
	import QuotePreview from './QuotePreview.svelte';
	import QuoteActionBar from './QuoteActionBar.svelte';
	import QuoteScopeEditor from './QuoteScopeEditor.svelte';
	import QuoteAiProposal from './QuoteAiProposal.svelte';
	import QuotePdfPreview from './QuotePdfPreview.svelte';
	import { readPdfResponse, samePdfIdentity, type PdfIdentity } from './pdf-preview.js';

	let { id }: { id: string } = $props();
	let quote = $state<Quote>();
	let draft = $state<QuoteDraft>();
	let imported = $state<QuoteImportResult>();
	let importOpen = $state(false);
	let reviewed = $state<QuoteLine[]>([]);
	let sourceRows = $state<number[]>([]);
	let mapping = $state(create(QuoteImportMappingSchema, { priceMode: QuotePriceMode.GROSS, firstRow: 2, lastRow: 2, nameColumn: 2, quantityColumn: 3, priceColumn: 4 }));
	let revisions = $state<QuoteRevisionInfo[]>([]);
	let revisionPdfs = $state<Record<string, GetQuotePdfResponse | undefined>>({});
	let operation = $state<GetQuoteOperationResponse>();
	let dismissedProposal = $state('');
	let publishedPdf = $state<GetQuotePdfResponse>();
	let currentPdf = $state<GetQuotePdfResponse>();
	let draftPdf = $state<GetQuotePdfResponse>();
	let preview = $state('');
	let previewBytes = $state<Uint8Array>();
	let previewIdentity = $state<PdfIdentity>();
	let previewAbort: AbortController | undefined;
	let previewTimer: ReturnType<typeof setTimeout> | undefined;
	let previewRevision = $state(0n);
	let previewError = $state('');
	let previewLoading = $state(false);
	let viewMode = $state<'editing' | 'preview'>('editing');
	let desktopPreview = $state(false);
	let previewRequest = 0;
	let file = $state<File>();
	let busy = $state(false);
	let saving = $state(false);
	let saveFailed = $state(false);
	let conflict = $state(false);
	let recoveryText = $state('');
	let actionBarHeight = $state(0);
	let dirty = $state(false);
	let error = $state('');
	let status = $state('');
	let extraError = $state('');
	let loaded = $state(false);
	let polling = false;
	let watching = '';
	let watchAbort: AbortController | undefined;
	let disposed = false;
	let revisionOffset = $state(0);
	let edit = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight: Promise<boolean> | undefined;
	const keys = new SvelteMap<string, string>();
	const pending = (value?: string) => value === 'running' || value === 'queued';
	const saveState = $derived(saving ? 'saving' : saveFailed ? 'error' : dirty ? 'dirty' : 'clean');

	function commandKey(operation: string) {
		let key = keys.get(operation);
		if (!key) { key = crypto.randomUUID(); keys.set(operation, key); }
		return key;
	}

	function adopt(value: Quote) {
		quote = value;
		draft = create(QuoteDraftSchema, value.draft);
		dirty = false;
		if (loaded && previewRevision === 0n) {
			if (draft.documentSchemaVersion === 2) schedulePdfPreview(); else void showPreview();
		}
	}

	function changed() {
		edit++;
		dirty = true;
		status = '';
		for (const key of keys.keys()) if (!key.startsWith('save:')) keys.delete(key);
		clearTimeout(timer);
		timer = setTimeout(() => { if (!busy && !conflict) void save(); }, 800);
	}

	function save(): Promise<boolean> {
		if (inFlight) return inFlight;
		if (conflict) return Promise.resolve(false);
		if (!dirty || !draft || !quote) return Promise.resolve(true);
		const start = edit;
		const keyScope = `save:${quote.draftVersion}:${start}`;
		const payload = create(QuoteDraftSchema, $state.snapshot(draft));
		const expectedVersion = quote.draftVersion;
		saving = true;
		saveFailed = false;
		error = '';
		inFlight = (async () => {
			try {
				const result = await getQuoteClient().saveDraft({ quoteId: id, draft: payload, expectedVersion, idempotencyKey: commandKey(keyScope) });
				keys.delete(keyScope);
				if (disposed) return false;
				if (!result.quote) {
					saveFailed = true;
					error = 'Nie otrzymano potwierdzenia zapisu szkicu.';
					return false;
				}
				quote = result.quote;
				if (edit === start) dirty = false;
				if (!dirty && previewRevision === 0n) {
					if (draft?.documentSchemaVersion === 2) schedulePdfPreview(); else void showPreview();
				}
				return !dirty;
			} catch (reason) {
				if (!disposed) { saveFailed = true; conflict = reason instanceof ConnectError && reason.code === Code.Aborted; error = quoteError(reason); }
				return false;
			} finally {
				saving = false;
				inFlight = undefined;
				if (!disposed && edit !== start && dirty && !conflict) timer = setTimeout(() => { if (!busy && !conflict) void save(); }, 250);
			}
		})();
		return inFlight;
	}

	async function loadServerVersion() {
		if (!draft || saving || busy) return;
		const start = edit;
		const local = JSON.stringify($state.snapshot(draft), null, 2);
		busy = true;
		try {
			const result = await getQuoteClient().getQuote({ quoteId: id });
			if (!result.quote) throw new Error('Nie otrzymano wersji serwera.');
			if (edit !== start) throw new Error('Formularz zmienił się podczas wczytywania. Spróbuj ponownie.');
			clearTimeout(timer); recoveryText = local; conflict = false; saveFailed = false; error = ''; keys.clear(); edit++;
			adopt(result.quote);
		} catch (reason) { error = quoteError(reason); }
		finally { busy = false; }
	}

	async function act(scope: string, action: (key: string) => Promise<void>, flush = true) {
		if (busy) return;
		busy = true;
		error = '';
		try {
			if (flush && !(await save())) return;
			await action(commandKey(scope));
			keys.delete(scope);
			if (!disposed) await refresh();
		} catch (reason) {
			if (!disposed) { if (reason instanceof ConnectError && reason.code === Code.Aborted) { conflict = true; saveFailed = true; } error = quoteError(reason); }
		} finally {
			busy = false;
		}
	}

	function publish(): void {
		void act('publish', async (key) => {
			if (!quote) return;
			const request = { quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key };
			const result = quote.currentRevision ? await getQuoteClient().publishQuoteRevision(request) : await getQuoteClient().approveQuote(request);
			if (!result.quote) throw new Error('Nie otrzymano potwierdzenia zatwierdzenia wyceny.');
			adopt(result.quote);
			status = 'Opublikowano rewizję.';
			await loadRevisions(0);
		});
	}

	async function loadQuote() {
		const response = await getQuoteClient().getQuote({ quoteId: id });
		if (!disposed && response.quote && !dirty && !saving) adopt(response.quote);
	}

	async function loadRevisions(offset = revisionOffset) {
		if (!quote?.currentRevision) return;
		const response = await getQuoteClient().listQuoteRevisions({ quoteId: id, pageOffset: offset, pageSize: 20 });
		if (!disposed) { revisions = response.revisions; revisionOffset = offset; }
	}

	async function optional<T>(call: Promise<T>): Promise<T | undefined> {
		try { return await call; }
		catch (reason) { if (!isMissing(reason)) throw reason; }
	}

	async function watchOperation(operationId: string) {
		if (watching === operationId || disposed) return;
		watchAbort?.abort();
		const controller = new AbortController();
		watchAbort = controller;
		watching = operationId;
		try {
			for await (const message of getQuoteClient().watchQuoteOperation({ quoteId: id, operationId }, { signal: controller.signal })) {
				if (disposed || controller.signal.aborted || watching !== operationId) return;
				const update = message.operation;
				if (!update) continue;
				operation = update;
				if (!pending(update.status)) { refreshQuietly(); return; }
			}
		} catch {
			// Periodic status refresh reconnects after network interruptions.
		} finally {
			if (watchAbort === controller) { watching = ''; watchAbort = undefined; }
		}
	}

	async function refresh() {
		if (!quote || disposed || polling) return;
		polling = true;
		try {
			const api = getQuoteClient();
			const version = quote.draftVersion;
			const [imp, gen, pdf, currentDraftPdf, newestPdf] = await Promise.allSettled([
				optional(api.getImportResult({ quoteId: id })),
				optional(api.getQuoteOperation({ quoteId: id })),
				quote.currentRevision ? optional(api.getQuotePdf({ quoteId: id })) : Promise.resolve(undefined),
				optional(api.getQuotePdf({ quoteId: id, draftVersion: version })),
				quote.currentRevision ? optional(api.getQuotePdf({ quoteId: id, revision: quote.currentRevision })) : Promise.resolve(undefined)
			]);
			if (disposed) return;
			if (imp.status === 'fulfilled' && imp.value?.result) {
				const result = imp.value.result;
				if (result.id !== imported?.id || result.applied !== imported?.applied) {
					importOpen = !result.applied;
				}
				if (result.id !== imported?.id || result.resultVersion !== imported?.resultVersion || result.status !== imported?.status) {
					const availableLines = result.lines.filter((line) => line.line);
					reviewed = availableLines.flatMap((line) => line.line ? [line.line] : []);
					sourceRows = availableLines.map((line) => line.sourceRow);
					if (result.mapping) {
						mapping = result.mapping;
					}
				}
				imported = result;
			}
			if (gen.status === 'fulfilled') {
				if (!(watching && operation?.operationId === gen.value?.operationId && pending(gen.value?.status))) operation = gen.value;
				if (operation && pending(operation.status)) void watchOperation(operation.operationId);
				if (draft?.documentSchemaVersion !== 2 && operation?.status === 'succeeded' && operation.draftVersion >= version && !dirty && !saving) await loadQuote();
			}
			if (pdf.status === 'fulfilled') publishedPdf = pdf.value;
			if (newestPdf.status === 'fulfilled') currentPdf = newestPdf.value;
			if (currentDraftPdf.status === 'fulfilled' && quote?.draftVersion === version) draftPdf = currentDraftPdf.value;
			const checking = revisions.filter((revision) => revisionPdfs[String(revision.revision)]?.status !== 'succeeded');
			const pdfs = await Promise.allSettled(checking.map((revision) => optional(api.getQuotePdf({ quoteId: id, revision: revision.revision }))));
			if (!disposed) {
				const next = { ...revisionPdfs };
				for (let i = 0; i < checking.length; i++) {
					const result = pdfs[i];
					if (result?.status === 'fulfilled') next[String(checking[i].revision)] = result.value;
				}
				revisionPdfs = next;
			}
			const rejected = [imp, gen, pdf, currentDraftPdf, newestPdf, ...pdfs].find((result) => result.status === 'rejected');
			extraError = rejected?.status === 'rejected' ? quoteError(rejected.reason) : '';
		} finally {
			polling = false;
		}
	}

	function refreshQuietly() {
		void refresh().catch((reason) => { if (!disposed) extraError = quoteError(reason); });
	}

	beforeNavigate(({ cancel, willUnload }) => {
		if (!willUnload && (dirty || saving || recoveryText) && !window.confirm('Opuścić wycenę z niezapisanymi zmianami lub kopią do odzyskania?')) cancel();
	});

	onMount(() => {
		void (async () => {
			try { await loadQuote(); await loadRevisions(); refreshQuietly(); if (draft?.documentSchemaVersion !== 2) void showPreview(); }
			catch (reason) { if (!disposed) error = quoteError(reason); }
			finally { loaded = true; }
		})();
		const poll = setInterval(() => {
			const statuses = [imported?.status, operation?.status, currentPdf?.status, draftPdf?.status,
				...Object.values(revisionPdfs).map((pdf) => pdf?.status)];
			if (!busy && shouldPollQuote(statuses, Boolean(extraError))) refreshQuietly();
		}, 2500);
		return () => { disposed = true; watchAbort?.abort(); previewAbort?.abort(); clearInterval(poll); clearTimeout(timer); clearTimeout(previewTimer); };
	});

	function schedulePdfPreview() {
		clearTimeout(previewTimer);
		if (!(desktopPreview || viewMode === 'preview') || previewRevision !== 0n) return;
		previewTimer = setTimeout(() => { if (!dirty && !saving) void showPreview(); }, 1500);
	}

	async function openPreview(revision = 0n) {
		if (draft?.documentSchemaVersion === 2 && !(await save())) return;
		viewMode = 'preview'; desktopPreview = true;
		await showPreview(revision);
	}

	function closePreview() {
		desktopPreview = false; viewMode = 'editing';
		if (draft?.documentSchemaVersion === 2) { previewAbort?.abort(); clearTimeout(previewTimer); previewRequest++; previewLoading = false; }
	}

	async function showPdfPreview(revision: bigint) {
		if (!quote || !draft) return;
		clearTimeout(previewTimer);
		previewAbort?.abort();
		const controller = new AbortController(); previewAbort = controller;
		const request = ++previewRequest;
		const identity: PdfIdentity = { quoteId: id, revision, draftVersion: revision ? 0n : quote.draftVersion, templateVersion: '4' };
		previewRevision = revision; previewError = '';
		if (previewIdentity && previewBytes && samePdfIdentity(previewIdentity, identity)) { previewLoading = false; return; }
		if (!revision && !draft.lines.length) { previewError = 'Dodaj pozycję, aby przygotować podgląd PDF.'; previewLoading = false; return; }
		previewLoading = true;
		const current = () => !disposed && !controller.signal.aborted && request === previewRequest && (revision !== 0n || (!dirty && quote?.draftVersion === identity.draftVersion));
		const pause = () => new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => { controller.signal.removeEventListener('abort', aborted); resolve(); }, 1500);
			function aborted() { clearTimeout(timer); reject(new DOMException('Przerwano', 'AbortError')); }
			controller.signal.addEventListener('abort', aborted, { once: true });
		});
		try {
			const api = getQuoteClient();
			let generated = false;
			while (current()) {
				let result: GetQuotePdfResponse | undefined;
				try { result = await api.getQuotePdf({ quoteId: id, revision, draftVersion: identity.draftVersion }); }
				catch (reason) {
					if (!revision && isMissing(reason) && !generated) {
						await api.generateDraftPdf({ quoteId: id, expectedVersion: identity.draftVersion, idempotencyKey: commandKey(`preview-pdf:${identity.draftVersion}`) });
						generated = true; refreshQuietly(); await pause(); continue;
					}
					throw reason;
				}
				if (!current()) return;
				if (result.revision !== identity.revision || result.draftVersion !== identity.draftVersion || result.templateVersion !== identity.templateVersion) throw new Error('Otrzymano PDF innej wersji wyceny.');
				if (result.status === 'failed') throw new Error('Generowanie PDF nie powiodło się.');
				if (result.status !== 'succeeded' || !result.url) { await pause(); continue; }
				let bytes: Uint8Array;
				try { bytes = await readPdfResponse(await fetch(result.url, { signal:controller.signal, credentials:'omit', cache:'no-store' })); }
				catch (reason) {
					if (!current()) return;
					const refreshed = await api.getQuotePdf({ quoteId:id, revision, draftVersion:identity.draftVersion });
					if (!current()) return;
					if (refreshed.revision !== identity.revision || refreshed.draftVersion !== identity.draftVersion || refreshed.templateVersion !== identity.templateVersion || !refreshed.url) throw reason;
					bytes = await readPdfResponse(await fetch(refreshed.url, { signal:controller.signal, credentials:'omit', cache:'no-store' }));
				}
				if (current()) { previewBytes = bytes; previewIdentity = identity; refreshQuietly(); }
				return;
			}
		} catch (reason) { if (current()) previewError = quoteError(reason); }
		finally { if (request === previewRequest) previewLoading = false; }
	}

	async function retryPdfPreview() {
		if (!quote) return;
		const revision = previewRevision, version = revision ? 0n : quote.draftVersion;
		try {
			await getQuoteClient().retryQuotePdf({quoteId:id, revision, draftVersion:version, idempotencyKey:commandKey(`retry-preview:${revision}:${version}`)});
			keys.delete(`retry-preview:${revision}:${version}`);
			await showPdfPreview(revision);
		} catch (reason) { previewError = quoteError(reason); }
	}

	async function showPreview(revision = 0n) {
		if (draft?.documentSchemaVersion === 2) return showPdfPreview(revision);
		if (revision !== previewRevision) preview = '';
		previewRevision = revision;
		const request = ++previewRequest;
		previewError = '';
		previewLoading = true;
		try {
			const response = await getQuoteClient().getQuotePreview({ quoteId: id, revision });
			if (!disposed && request === previewRequest) preview = response.html;
		} catch (reason) { if (!disposed && request === previewRequest) previewError = quoteError(reason); }
		finally { if (!disposed && request === previewRequest) previewLoading = false; }
	}

	async function download(revision: bigint, draftVersion = 0n) {
		try {
			const result = await getQuoteClient().getQuotePdf({ quoteId: id, revision, draftVersion });
			if (result.url) window.location.assign(result.url);
			else if (result.status === 'failed') status = 'Eksport nie powiódł się. Możesz ponowić generowanie PDF.';
			else status = 'PDF jest w przygotowaniu.';
		} catch (reason) { error = quoteError(reason); }
	}
</script>

<svelte:window onbeforeunload={(event) => { if (dirty || saving || recoveryText) { event.preventDefault(); event.returnValue = ''; } }} />

<section class="quote-editor mx-auto max-w-7xl space-y-4" style:--quote-action-height="{actionBarHeight}px">
	<a class="inline-flex items-center gap-2 text-sm font-medium text-text-muted hover:text-primary" href={resolve('/wyceny')}>← Wróć do wycen</a>
	{#if error}<p role="alert" class="rounded border border-red-400 p-3">{error}</p>{/if}
	{#if conflict}<div class="rounded border border-amber-400 p-3"><p>Wczytaj wersję serwera, aby kontynuować. Twoje obecne dane zostaną pokazane do skopiowania.</p><button class={button} type="button" disabled={busy || saving} onclick={loadServerVersion}>Wczytaj wersję serwera</button></div>{/if}
	{#if recoveryText}<details class="rounded border border-border-line p-3"><summary class="cursor-pointer">Twoje zmiany przed wczytaniem wersji serwera</summary><label>Odzyskane zmiany<textarea class={field} aria-label="Odzyskane zmiany" readonly rows="8" value={recoveryText}></textarea></label><button class={button} type="button" onclick={() => recoveryText = ''}>Zamknij kopię</button></details>{/if}
	{#if !loaded}<p role="status">Wczytywanie szkicu…</p>{/if}
	{#if quote && draft}
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold">{draft.title || 'Wycena'}</h1>
				<p class="mt-1 text-sm text-text-muted">{quote.number || 'Szkic'}{quote.currentRevision ? ` · v${quote.currentRevision}` : ''}{quote.archived ? ' · Archiwum' : ''}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button type="button" class="{button} desktop-only" aria-label="Pokaż podgląd na desktopie" aria-expanded={desktopPreview} aria-controls="quote-preview" onclick={() => { if (draft?.documentSchemaVersion === 2) { if (desktopPreview) closePreview(); else void openPreview(); } else desktopPreview = !desktopPreview; }}>{desktopPreview ? 'Ukryj podgląd' : 'Podgląd'}</button>
				<button type="button" class={button} disabled={busy || saving} onclick={() => act('archive', async (key) => {
					if (!quote) return;
					const request = { quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key };
					const result = quote.archived ? await getQuoteClient().restoreQuote(request) : await getQuoteClient().archiveQuote(request);
					if (result.quote) adopt(result.quote);
				})}>{quote.archived ? 'Przywróć' : 'Archiwizuj'}</button>
				<button type="button" class="{button} desktop-only" disabled={busy || saving || quote.archived} onclick={save}>Zapisz szkic</button>
				<button type="button" class="{primary} desktop-only" disabled={busy || saving || quote.archived} onclick={publish}>{quote.currentRevision ? (draft.documentSchemaVersion === 2 ? 'Opublikuj rewizję' : 'Zapisz zmiany') : 'Zatwierdź wycenę'}</button>
			</div>
		</header>
		<div class="desktop-only flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite">
			<span>{saving ? 'Zapisywanie…' : saveFailed ? 'Nie udało się zapisać' : dirty ? 'Niezapisane zmiany' : 'Zapisano'}</span>
			{#if saveFailed}<button type="button" class="underline" disabled={busy || saving} onclick={save}>Ponów zapis</button>{/if}
		</div>
		{#if status}<p role="status">{status}</p>{/if}
		{#if extraError}<p class="text-sm text-text-muted" role="status">{extraError}</p>{/if}
		<div class="mobile-only gap-2" role="group" aria-label="Widok wyceny">
			<button type="button" class={button} aria-label="Pokaż edycję wyceny" aria-pressed={viewMode === 'editing'} onclick={() => { if (draft?.documentSchemaVersion === 2) closePreview(); else viewMode = 'editing'; }}>Edycja</button>
			<button type="button" class={button} aria-label="Pokaż podgląd wyceny" aria-pressed={viewMode === 'preview'} onclick={() => { if (draft?.documentSchemaVersion === 2) void openPreview(); else viewMode = 'preview'; }}>Podgląd</button>
		</div>
		<div class:desktop-preview-open={desktopPreview} class="quote-workspace grid gap-6">
		<div class="editing-pane min-w-0 space-y-4" class:mobile-preview={viewMode === 'preview'}>
		<nav class="quote-sections flex flex-wrap gap-x-5 gap-y-2 border-b border-border-line text-sm" aria-label="Sekcje wyceny">
			<a class="pb-3 font-medium text-text-muted hover:text-primary" href="#quote-data">Dane</a>
			<a class="pb-3 font-medium text-text-muted hover:text-primary" href="#quote-lines">Pozycje</a>
			<a class="pb-3 font-medium text-text-muted hover:text-primary" href="#quote-content">{draft.documentSchemaVersion === 2 ? 'Zakres' : 'Treść'}</a>
			<a class="pb-3 font-medium text-text-muted hover:text-primary" href="#quote-documents">Dokumenty</a>
		</nav>
		<fieldset id="quote-data" class="{panel} quote-data" disabled={busy || quote.archived}>
			<legend class="px-2 font-semibold">Dane wyceny</legend>
			<div class="grid gap-3 sm:grid-cols-2">
				<label>Tytuł<input class={field} bind:value={draft.title} oninput={changed} /></label>
				<label>Klient<input class={field} bind:value={draft.client} oninput={changed} /></label>
				{#if draft.documentSchemaVersion === 2}<label>Data dokumentu<input class={field} type="date" bind:value={draft.documentDate} oninput={changed} /></label>{/if}
			</div>
			<p class="text-sm text-text-muted">Ceny w tej wycenie: {draft.priceMode === QuotePriceMode.NET ? 'netto (zapisane wcześniej)' : 'brutto'}.</p>
			<div id="quote-lines"><h2 class="mb-2 font-semibold">Pozycje</h2><QuoteLines bind:lines={draft.lines} net={draft.priceMode === QuotePriceMode.NET} onchange={changed} /></div>
			{#if draft.priceMode === QuotePriceMode.NET}<p role="status">Ta starsza wycena ma ceny netto. Import pozycji zastąpi je cenami brutto.</p>{/if}
		</fieldset>

		<fieldset class={panel} disabled={busy || saving || quote.archived}>
			<legend class="px-1 font-semibold">Import XLSX</legend>
			{#if imported?.applied}<p class="text-sm" role="status">Import zapisany w szkicu.</p>{/if}
			<details bind:open={importOpen}>
				<summary class="cursor-pointer text-sm font-medium">Rozwiń import XLSX</summary>
				<div class="mt-3 space-y-4">
			<div class="flex flex-wrap items-end gap-2">
				<label class="text-sm">Plik XLSX<input class={field} type="file" accept=".xlsx" onchange={(event) => {
					file = event.currentTarget.files?.[0];
					keys.delete('upload');
				}} /></label>
				<button class={button} type="button" disabled={!file} onclick={() => act('upload', async (key) => {
					if (!file || !quote) return;
					if (file.size > 5 * 1024 * 1024) throw new Error('Plik może mieć maksymalnie 5 MiB.');
					await getQuoteClient().uploadQuoteXlsx({ quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key, xlsx: new Uint8Array(await file.arrayBuffer()) });
					status = 'Zlecono analizę arkusza.';
				})}>Prześlij arkusz</button>
			</div>
			{#if imported}
				{#if pending(imported.status)}<p role="status">Analiza arkusza w toku…</p>
				{:else if !imported.applied}
					{#if imported.status === 'succeeded'}
						<div class="rounded-lg border border-border-line p-4">
							<h2 class="font-semibold">Sprawdź pozycje z arkusza</h2>
							<p class="mt-1 text-sm text-text-muted">Ceny są podane brutto. Możesz poprawić pozycje przed dodaniem ich do wyceny. Zastąpią one obecne pozycje.</p>
							<p class="mt-3 text-sm">Suma pozycji: {imported.baseTotal} PLN{imported.sourceTotal ? ` · Suma arkusza: ${imported.sourceTotal} PLN` : ''}</p>
						</div>
						{#each imported.warnings as warning, index (index)}
							<p role="alert">{warning === 'source_total_mismatch' ? 'Suma pozycji różni się od sumy podanej w pliku.' : warning}</p>
						{/each}
						<QuoteLines bind:lines={reviewed} bind:sourceRows onchange={() => keys.delete('apply')} />
						<button class={primary} type="button" onclick={() => act('apply', async (key) => {
							if (!quote || !imported) return;
							const result = await getQuoteClient().applyImport({
								quoteId: id, importId: imported.id, resultVersion: imported.resultVersion,
								expectedVersion: quote.draftVersion, idempotencyKey: key, reviewedLines: reviewed, priceMode: QuotePriceMode.GROSS
							});
							if (result.quote) adopt(result.quote);
						})}>Zastosuj sprawdzone pozycje</button>
					{:else}
						{#if imported.errorCode === 'unsupported_input_formula'}
							<p role="status">Arkusz zawiera nieobsługiwaną formułę w danych wejściowych. Zastąp ją wartością w pliku i prześlij plik ponownie albo wskaż inne kolumny.</p>
						{:else}
							<p role="status">Nie udało się rozpoznać tabeli. Wskaż arkusz i kolumny ręcznie.{imported.errorCode ? ` Kod błędu: ${imported.errorCode}.` : ''}</p>
						{/if}
					{/if}
					<details class="space-y-3" oninput={() => keys.delete('remap')} onchange={() => keys.delete('remap')}>
						<summary class="cursor-pointer">Ręczne mapowanie</summary>
						<div class="grid gap-2 sm:grid-cols-4">
							<label>Arkusz<input class={field} bind:value={mapping.sheet} /></label>
							<label>Pierwszy wiersz<input class={field} type="number" min="1" bind:value={mapping.firstRow} /></label>
							<label>Ostatni wiersz<input class={field} type="number" min="1" bind:value={mapping.lastRow} /></label>
							<label>Kolumna nazwy<input class={field} type="number" min="1" bind:value={mapping.nameColumn} /></label>
							<label>Kolumna ilości<input class={field} type="number" min="1" bind:value={mapping.quantityColumn} /></label>
							<label>Kolumna ceny<input class={field} type="number" min="1" bind:value={mapping.priceColumn} /></label>
							<label>Komórka sumy<input class={field} bind:value={mapping.totalCell} placeholder="np. E13" /></label>
						</div>
						<button class={button} type="button" onclick={() => act('remap', async (key) => {
							if (!quote || !imported) return;
							await getQuoteClient().remapQuoteImport({ quoteId: id, importId: imported.id, expectedVersion: quote.draftVersion, idempotencyKey: key, mapping: { ...mapping, priceMode: QuotePriceMode.GROSS } });
						})}>Przelicz mapowanie</button>
					</details>
				{/if}
			{/if}
				</div>
			</details>
		</fieldset>

		<fieldset id="quote-content" class={panel} disabled={busy || quote.archived}>
			<legend class="px-1 font-semibold">{draft.documentSchemaVersion === 2 ? 'Zakres' : 'Treść oferty'}</legend>
			{#if draft.documentSchemaVersion === 2}
				<label class="block text-sm">Standard opisu
					<select class={field} bind:value={draft.descriptionStandard} onchange={changed}>
						<option value={QuoteDescriptionStandard.UNSPECIFIED}>Bez standardu</option>
						<option value={QuoteDescriptionStandard.GENERAL}>Ogólny</option>
						<option value={QuoteDescriptionStandard.MONITORING}>Monitoring</option>
						<option value={QuoteDescriptionStandard.ACCESS_CONTROL}>Kontrola dostępu</option>
						<option value={QuoteDescriptionStandard.INTERCOM}>Domofon</option>
					</select>
				</label>
				<QuoteScopeEditor bind:sections={draft.scopeSections} onchange={changed} />
			{/if}
			<button class={button} type="button" disabled={pending(operation?.status)} onclick={() => act('generate', async (key) => {
				if (!quote) return;
				if (operation?.status === 'uncertain' && !window.confirm('Rozpocząć nowe, potencjalnie płatne generowanie?')) return;
				await getQuoteClient().generateQuoteText({ quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key });
			})}>{pending(operation?.status) ? 'Generowanie opisu…' : 'Generuj opis AI'}</button>
			{#if operation}<QuoteAiActivity {operation} proposal={draft.documentSchemaVersion === 2} />{/if}
			{#if draft.documentSchemaVersion === 2 && operation?.status === 'succeeded' && operation.operationId !== dismissedProposal}
				<QuoteAiProposal current={draft.scopeSections} proposal={operation.proposedScopeSections} stale={dirty || saving || operation.draftVersion !== quote.draftVersion} ondismiss={() => dismissedProposal = operation?.operationId || ''} onapply={() => act('apply-text', async (key) => {
					if (!quote || !operation || dirty || operation.draftVersion !== quote.draftVersion) return;
					const result = await getQuoteClient().applyQuoteText({quoteId:id, operationId:operation.operationId, expectedVersion:quote.draftVersion, idempotencyKey:key});
					dismissedProposal = operation.operationId;
					if (result.quote) adopt(result.quote);
				}, false)} />
			{:else if draft.documentSchemaVersion !== 2}
			<label class="block">Wstęp<textarea class={field} rows="3" bind:value={draft.introduction} oninput={changed}></textarea></label>
			<label class="block">Zakres prac<textarea class={field} rows="3" bind:value={draft.scope} oninput={changed}></textarea></label>
			<label class="block">Opis techniczny<textarea class={field} rows="3" bind:value={draft.technicalDescription} oninput={changed}></textarea></label>
			<label class="block">Zakończenie<textarea class={field} rows="3" bind:value={draft.conclusion} oninput={changed}></textarea></label>
			{/if}
		</fieldset>

		<div id="quote-documents" class={panel}>
			<h2 class="font-semibold">Dokumenty</h2>
			<div class="flex flex-wrap gap-2">
				<button class={button} disabled={busy || saving} onclick={() => openPreview()}>Podgląd szkicu</button>
				<button class={button} disabled={busy || quote.archived} onclick={() => draft?.documentSchemaVersion === 2 ? void openPreview() : act('draft-pdf', async (key) => {
					if (!quote) return;
					await getQuoteClient().generateDraftPdf({ quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key });
				})}>Generuj PDF szkicu</button>
				{#if !dirty && !saving && draftPdf?.draftVersion === quote.draftVersion && draftPdf?.url}
					<button class={button} onclick={() => download(0n, draftPdf?.draftVersion)}>Pobierz PDF szkicu</button>
				{:else if !dirty && !saving && draftPdf?.draftVersion === quote.draftVersion && pending(draftPdf?.status)}<span role="status">PDF szkicu w przygotowaniu…</span>
				{:else if !dirty && !saving && draftPdf?.draftVersion === quote.draftVersion && draftPdf?.status === 'failed'}
					<button class={button} disabled={busy} onclick={() => act('retry-draft', async (key) => {
						if (!draftPdf) return;
						await getQuoteClient().retryQuotePdf({ quoteId: id, draftVersion: draftPdf.draftVersion, idempotencyKey: key });
					}, false)}>Ponów PDF szkicu</button>
				{/if}
				{#if pending(currentPdf?.status)}<span role="status">PDF najnowszej rewizji w przygotowaniu…</span>
				{:else if currentPdf?.status === 'failed'}<span role="status">PDF najnowszej rewizji wymaga ponowienia.</span>{/if}
				{#if publishedPdf?.url}<button class={primary} onclick={() => download(0n)}>Pobierz najnowszy gotowy PDF</button>{/if}
			</div>
			{#if revisions.length}
				<h3 class="font-semibold">Historia rewizji</h3>
				<ul class="divide-y divide-border-line">
					{#each revisions as revision (revision.revision)}
						<li class="flex flex-wrap items-center gap-2 py-2">
							<span class="mr-auto">v{revision.revision} · {new Date(revision.publishedAt).toLocaleString('pl-PL')}</span>
							<span role="status">PDF: {revisionPdfs[String(revision.revision)]?.status === 'succeeded' ? 'gotowy' : revisionPdfs[String(revision.revision)]?.status === 'failed' ? 'błąd' : pending(revisionPdfs[String(revision.revision)]?.status) ? 'w przygotowaniu' : 'brak informacji'}</span>
							<button class={button} onclick={() => openPreview(revision.revision)}>Podgląd</button>
							<button class={button} disabled={revisionPdfs[String(revision.revision)]?.status !== 'succeeded'} onclick={() => download(revision.revision)}>Pobierz PDF</button>
							{#if revisionPdfs[String(revision.revision)]?.status === 'failed'}
								<button class={button} disabled={busy} onclick={() => act(`retry:${revision.revision}`, async (key) => {
									await getQuoteClient().retryQuotePdf({ quoteId: id, revision: revision.revision, idempotencyKey: key });
								}, false)}>Ponów PDF</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if revisionOffset > 0}<button class={button} onclick={() => loadRevisions(revisionOffset - 20)}>Nowsze</button>{/if}
				{#if revisions.length === 20}<button class={button} onclick={() => loadRevisions(revisionOffset + 20)}>Starsze</button>{/if}
			{/if}
		</div>
		</div>
		<aside id="quote-preview" class:desktop-preview-visible={desktopPreview} class:mobile-hidden={viewMode === 'editing'} class="quote-preview min-w-0">
			<section class={panel}>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div><h2 class="font-semibold">Podgląd dokumentu{previewRevision ? ` · v${previewRevision}` : ' · szkic'}</h2><p class="text-sm text-text-muted">{draft.documentSchemaVersion === 2 && previewBytes && (dirty || saving || previewLoading || previewError || previewIdentity?.revision !== previewRevision || (!previewRevision && previewIdentity?.draftVersion !== quote.draftVersion)) ? 'Podgląd poprzedniej zapisanej wersji.' : previewRevision ? 'Podgląd zapisanej rewizji.' : dirty || saving ? 'Podgląd odświeży się po zapisaniu zmian.' : previewLoading || previewError ? 'Podgląd może nie zawierać ostatnio zapisanych zmian.' : 'Podgląd ostatnio zapisanego szkicu.'}</p></div>
					{#if previewRevision}<button class={button} onclick={() => showPreview()}>Podgląd szkicu</button>{/if}
				</div>
				{#if previewLoading && (preview || previewBytes)}<p role="status" class="text-sm">Odświeżanie podglądu…</p>{/if}
				{#if previewError}<p role="status" class="text-sm">Nie udało się odświeżyć podglądu: {previewError} <button class="underline" onclick={() => draft?.documentSchemaVersion === 2 && previewError === 'Generowanie PDF nie powiodło się.' ? retryPdfPreview() : showPreview(previewRevision)}>Spróbuj ponownie</button></p>{/if}
				{#if draft.documentSchemaVersion === 2}
					{#if previewBytes}<QuotePdfPreview bytes={previewBytes} />{:else if previewLoading}<p role="status">Przygotowywanie PDF…</p>{/if}
				{:else if preview}<QuotePreview html={preview} />{:else if !previewError}<p role="status">Wczytywanie podglądu…</p>{/if}
			</section>
		</aside>
		</div>
		<QuoteActionBar {saveState} disabled={busy || saving || quote.archived} approveLabel={quote.currentRevision ? (draft.documentSchemaVersion === 2 ? 'Opublikuj rewizję' : 'Zapisz zmiany') : 'Zatwierdź wycenę'} onsave={save} onapprove={publish} bind:height={actionBarHeight} />
	{/if}
</section>

<style>
	.quote-editor { container: quote-editor / inline-size; }
	.desktop-only { display: none; }
	.mobile-only { display: flex; }
	.editing-pane.mobile-preview, .quote-preview.mobile-hidden { display: none; }
	@container quote-editor (min-width: 1084px) {
		.desktop-only { display: inline-flex; }
		.mobile-only { display: none; }
		.quote-workspace.desktop-preview-open { grid-template-columns: minmax(640px, 1fr) minmax(420px, 0.8fr); }
		.editing-pane.mobile-preview { display: block; }
		.quote-preview { display: none; position: sticky; top: 1rem; align-self: start; }
		.quote-preview.desktop-preview-visible { display: block; }
	}
	.quote-editor :global(input), .quote-editor :global(textarea), .quote-editor :global(select) {
		scroll-margin-bottom: calc(var(--quote-action-height, 0px) + var(--transfer-offset, 0px) + 1rem);
	}
	.quote-data > legend { padding-inline: 0.5rem; }
	.quote-data > div:first-of-type { margin-top: 0; }
	.quote-data > div:first-of-type label { display: grid; gap: 0.375rem; font-size: 0.875rem; font-weight: 500; }
	.quote-data > div:first-of-type input { font-weight: 400; }
	.quote-sections a { display: inline-flex; align-items: center; }
</style>
