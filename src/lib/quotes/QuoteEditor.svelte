<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { create } from '@bufbuild/protobuf';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getQuoteClient } from '#lib/api.js';
	import {
		QuoteDraftSchema, QuoteImportMappingSchema, QuotePriceMode,
		type Quote, type QuoteDraft, type QuoteLine, type QuoteImportResult,
		type QuoteRevisionInfo, type GetQuoteOperationResponse, type GetQuotePdfResponse
	} from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field, isMissing, panel, primary, quoteError } from './ui.js';
	import QuoteLines from './QuoteLines.svelte';

	let { id }: { id: string } = $props();
	let quote = $state<Quote>();
	let draft = $state<QuoteDraft>();
	let imported = $state<QuoteImportResult>();
	let reviewed = $state<QuoteLine[]>([]);
	let sourceRows = $state<number[]>([]);
	let importMode = $state(QuotePriceMode.GROSS);
	let mapping = $state(create(QuoteImportMappingSchema, { priceMode: QuotePriceMode.GROSS, firstRow: 2, lastRow: 2, nameColumn: 2, quantityColumn: 3, priceColumn: 4 }));
	let revisions = $state<QuoteRevisionInfo[]>([]);
	let operation = $state<GetQuoteOperationResponse>();
	let publishedPdf = $state<GetQuotePdfResponse>();
	let currentPdf = $state<GetQuotePdfResponse>();
	let draftPdf = $state<GetQuotePdfResponse>();
	let preview = $state('');
	let file = $state<File>();
	let busy = $state(false);
	let saving = $state(false);
	let dirty = $state(false);
	let error = $state('');
	let status = $state('');
	let extraError = $state('');
	let loaded = $state(false);
	let polling = false;
	let disposed = false;
	let revisionOffset = $state(0);
	let edit = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inFlight: Promise<boolean> | undefined;
	const keys = new SvelteMap<string, string>();
	const pending = (value?: string) => value === 'running' || value === 'queued';

	function commandKey(operation: string) {
		let key = keys.get(operation);
		if (!key) { key = crypto.randomUUID(); keys.set(operation, key); }
		return key;
	}

	function adopt(value: Quote) {
		quote = value;
		draft = create(QuoteDraftSchema, value.draft);
		dirty = false;
	}

	function changed() {
		edit++;
		dirty = true;
		status = 'Niezapisane zmiany';
		for (const key of keys.keys()) if (!key.startsWith('save:')) keys.delete(key);
		clearTimeout(timer);
		timer = setTimeout(() => { if (!busy) void save(); }, 800);
	}

	function save(): Promise<boolean> {
		if (inFlight) return inFlight;
		if (!dirty || !draft || !quote) return Promise.resolve(true);
		const start = edit;
		const keyScope = `save:${quote.draftVersion}:${start}`;
		const payload = create(QuoteDraftSchema, $state.snapshot(draft));
		const expectedVersion = quote.draftVersion;
		saving = true;
		error = '';
		inFlight = (async () => {
			try {
				const result = await getQuoteClient().saveDraft({ quoteId: id, draft: payload, expectedVersion, idempotencyKey: commandKey(keyScope) });
				keys.delete(keyScope);
				if (!result.quote || disposed) return false;
				quote = result.quote;
				if (edit === start) dirty = false;
				status = dirty ? 'Niezapisane zmiany' : 'Szkic zapisany';
				return !dirty;
			} catch (reason) {
				if (!disposed) error = quoteError(reason);
				return false;
			} finally {
				saving = false;
				inFlight = undefined;
				if (!disposed && edit !== start && dirty) timer = setTimeout(() => { if (!busy) void save(); }, 250);
			}
		})();
		return inFlight;
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
			if (!disposed) error = quoteError(reason);
		} finally {
			busy = false;
		}
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
				if (result.id !== imported?.id || result.resultVersion !== imported?.resultVersion || result.status !== imported?.status) {
					reviewed = result.lines.flatMap((line) => line.line ? [line.line] : []);
					sourceRows = result.lines.map((line) => line.sourceRow);
					if (result.mapping) {
						mapping = result.mapping;
						importMode = result.mapping.priceMode;
					}
				}
				imported = result;
			}
			if (gen.status === 'fulfilled') {
				operation = gen.value;
				if (operation?.status === 'succeeded' && operation.draftVersion >= version && !dirty && !saving) await loadQuote();
			}
			if (pdf.status === 'fulfilled') publishedPdf = pdf.value;
			if (newestPdf.status === 'fulfilled') currentPdf = newestPdf.value;
			if (currentDraftPdf.status === 'fulfilled' && quote?.draftVersion === version) draftPdf = currentDraftPdf.value;
			const rejected = [imp, gen, pdf, currentDraftPdf, newestPdf].find((result) => result.status === 'rejected');
			extraError = rejected?.status === 'rejected' ? quoteError(rejected.reason) : '';
		} finally {
			polling = false;
		}
	}

	function refreshQuietly() {
		void refresh().catch((reason) => { if (!disposed) extraError = quoteError(reason); });
	}

	beforeNavigate(({ cancel, willUnload }) => {
		if (!willUnload && (dirty || saving) && !window.confirm('Opuścić wycenę z niezapisanymi zmianami?')) cancel();
	});

	onMount(() => {
		void (async () => {
			try { await loadQuote(); await loadRevisions(); refreshQuietly(); }
			catch (reason) { if (!disposed) error = quoteError(reason); }
			finally { loaded = true; }
		})();
		const poll = setInterval(() => { if (!busy) refreshQuietly(); }, 2500);
		return () => { disposed = true; clearInterval(poll); clearTimeout(timer); };
	});

	async function showPreview(revision = 0n) {
		try {
			const response = await getQuoteClient().getQuotePreview({ quoteId: id, revision });
			if (!disposed) preview = response.html;
		} catch (reason) { error = quoteError(reason); }
	}

	async function download(revision: bigint) {
		try {
			const result = await getQuoteClient().getQuotePdf({ quoteId: id, revision });
			if (result.url) window.location.assign(result.url);
			else if (result.status === 'failed') status = 'Eksport nie powiódł się. Możesz ponowić generowanie PDF.';
			else status = 'PDF jest w przygotowaniu.';
		} catch (reason) { error = quoteError(reason); }
	}
</script>

<svelte:window onbeforeunload={(event) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } }} />

<section class="mx-auto max-w-6xl space-y-4">
	<a class="text-sm underline" href={resolve('/wyceny')}>Wróć do wycen</a>
	{#if error}<p role="alert" class="rounded border border-red-400 p-3">{error}</p>{/if}
	{#if !loaded}<p role="status">Wczytywanie szkicu…</p>{/if}
	{#if quote && draft}
		<header class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold">{draft.title || 'Wycena'}</h1>
				<p class="text-sm text-text-muted">{quote.number || 'Szkic'}{quote.currentRevision ? ` · v${quote.currentRevision}` : ''}{quote.archived ? ' · Archiwum' : ''}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<button type="button" class={button} disabled={busy || saving} onclick={() => act('archive', async (key) => {
					if (!quote) return;
					const request = { quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key };
					const result = quote.archived ? await getQuoteClient().restoreQuote(request) : await getQuoteClient().archiveQuote(request);
					if (result.quote) adopt(result.quote);
				})}>{quote.archived ? 'Przywróć' : 'Archiwizuj'}</button>
				<button type="button" class={button} disabled={busy || saving || quote.archived} onclick={save}>Zapisz szkic</button>
				<button type="button" class={primary} disabled={busy || saving || quote.archived} onclick={() => act('publish', async (key) => {
					if (!quote) return;
					const request = { quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key };
					const result = quote.currentRevision ? await getQuoteClient().publishQuoteRevision(request) : await getQuoteClient().approveQuote(request);
					if (result.quote) adopt(result.quote);
					status = 'Opublikowano rewizję. PDF jest w przygotowaniu.';
					await loadRevisions(0);
				})}>{quote.currentRevision ? 'Zapisz zmiany' : 'Zatwierdź wycenę'}</button>
			</div>
		</header>
		{#if status || saving}<p role="status">{saving ? 'Zapisywanie szkicu…' : status}</p>{/if}
		{#if extraError}<p class="text-sm text-text-muted" role="status">{extraError}</p>{/if}
		<fieldset class={panel} disabled={busy || quote.archived}>
			<legend class="px-1 font-semibold">Dane wyceny</legend>
			<div class="grid gap-3 sm:grid-cols-3">
				<label>Tytuł<input class={field} bind:value={draft.title} oninput={changed} /></label>
				<label>Klient<input class={field} bind:value={draft.client} oninput={changed} /></label>
				<label>Tryb cen
					<select class={field} bind:value={draft.priceMode} onchange={changed}>
						<option value={QuotePriceMode.GROSS}>Brutto</option><option value={QuotePriceMode.NET}>Netto</option>
					</select>
				</label>
			</div>
			<QuoteLines bind:lines={draft.lines} onchange={changed} />
		</fieldset>

		<fieldset class={panel} disabled={busy || saving || quote.archived}>
			<legend class="px-1 font-semibold">Import XLSX</legend>
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
				{:else if imported.applied}<p>Import zapisany w szkicu.</p>
				{:else}
					{#if imported.status === 'succeeded'}
						<p>Sprawdź pozycje i tryb cen. Zastosowanie importu zastąpi dotychczasowe pozycje szkicu.</p>
						<p>Suma pozycji: {imported.baseTotal} PLN{imported.sourceTotal ? ` · Suma arkusza: ${imported.sourceTotal} PLN` : ''}</p>
						{#if imported.warnings.includes('source_total_mismatch')}<p role="alert">Suma pozycji różni się od sumy podanej w pliku.</p>{/if}
						<label>Tryb cen importu<select class={field} bind:value={importMode}>
							<option value={QuotePriceMode.GROSS}>Brutto</option><option value={QuotePriceMode.NET}>Netto</option>
						</select></label>
						<QuoteLines bind:lines={reviewed} bind:sourceRows onchange={() => keys.delete('apply')} />
						<button class={primary} type="button" onclick={() => act('apply', async (key) => {
							if (!quote || !imported) return;
							const result = await getQuoteClient().applyImport({
								quoteId: id, importId: imported.id, resultVersion: imported.resultVersion,
								expectedVersion: quote.draftVersion, idempotencyKey: key, reviewedLines: reviewed, priceMode: importMode
							});
							if (result.quote) adopt(result.quote);
						})}>Zastosuj sprawdzone pozycje</button>
					{:else}
						{#if imported.errorCode === 'unsupported_input_formula'}
							<p role="status">Arkusz zawiera nieobsługiwaną formułę w danych wejściowych. Zastąp ją wartością w pliku i prześlij plik ponownie albo wskaż inne kolumny.</p>
						{:else}
							<p role="status">Nie udało się rozpoznać tabeli. Wskaż arkusz i kolumny ręcznie.</p>
						{/if}
					{/if}
					<details class="space-y-3">
						<summary class="cursor-pointer">Ręczne mapowanie</summary>
						<div class="grid gap-2 sm:grid-cols-4">
							<label>Arkusz<input class={field} bind:value={mapping.sheet} /></label>
							<label>Pierwszy wiersz<input class={field} type="number" min="1" bind:value={mapping.firstRow} /></label>
							<label>Ostatni wiersz<input class={field} type="number" min="1" bind:value={mapping.lastRow} /></label>
							<label>Kolumna nazwy<input class={field} type="number" min="1" bind:value={mapping.nameColumn} /></label>
							<label>Kolumna ilości<input class={field} type="number" min="1" bind:value={mapping.quantityColumn} /></label>
							<label>Kolumna ceny<input class={field} type="number" min="1" bind:value={mapping.priceColumn} /></label>
							<label>Komórka sumy<input class={field} bind:value={mapping.totalCell} placeholder="np. E13" /></label>
							<label>Tryb cen<select class={field} bind:value={mapping.priceMode}>
								<option value={QuotePriceMode.GROSS}>Brutto</option><option value={QuotePriceMode.NET}>Netto</option>
							</select></label>
						</div>
						<button class={button} type="button" onclick={() => act('remap', async (key) => {
							if (!quote || !imported) return;
							await getQuoteClient().remapQuoteImport({ quoteId: id, importId: imported.id, expectedVersion: quote.draftVersion, idempotencyKey: key, mapping });
						})}>Przelicz mapowanie</button>
					</details>
				{/if}
			{/if}
		</fieldset>

		<fieldset class={panel} disabled={busy || quote.archived}>
			<legend class="px-1 font-semibold">Treść oferty</legend>
			{#if operation?.status === 'uncertain'}
				<p role="alert">Wynik poprzedniej operacji AI jest niepewny. Nowa próba może zostać ponownie rozliczona.</p>
			{:else if operation?.status === 'conflict'}
				<p role="status">Szkic zmienił się podczas generowania. AI nie nadpisało edycji.</p>
			{:else if operation?.status === 'failed'}
				<p role="status">Nie udało się wygenerować opisu. Możesz ponowić próbę.</p>
			{/if}
			<button class={button} type="button" disabled={pending(operation?.status)} onclick={() => act('generate', async (key) => {
				if (!quote) return;
				if (operation?.status === 'uncertain' && !window.confirm('Rozpocząć nowe, potencjalnie płatne generowanie?')) return;
				await getQuoteClient().generateQuoteText({ quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key });
			})}>{pending(operation?.status) ? 'Generowanie opisu…' : 'Generuj opis AI'}</button>
			<label class="block">Wstęp<textarea class={field} rows="3" bind:value={draft.introduction} oninput={changed}></textarea></label>
			<label class="block">Zakres prac<textarea class={field} rows="3" bind:value={draft.scope} oninput={changed}></textarea></label>
			<label class="block">Opis techniczny<textarea class={field} rows="3" bind:value={draft.technicalDescription} oninput={changed}></textarea></label>
			<label class="block">Zakończenie<textarea class={field} rows="3" bind:value={draft.conclusion} oninput={changed}></textarea></label>
		</fieldset>

		<div class={panel}>
			<h2 class="font-semibold">Dokumenty</h2>
			<div class="flex flex-wrap gap-2">
				<button class={button} disabled={busy || saving} onclick={async () => { if (await save()) await showPreview(); }}>Podgląd szkicu</button>
				<button class={button} disabled={busy || quote.archived} onclick={() => act('draft-pdf', async (key) => {
					if (!quote) return;
					await getQuoteClient().generateDraftPdf({ quoteId: id, expectedVersion: quote.draftVersion, idempotencyKey: key });
				})}>Generuj PDF szkicu</button>
				{#if draftPdf?.url}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Signed external R2 URL. -->
					<a class={button} href={draftPdf.url} rel="noreferrer">Pobierz PDF szkicu</a>
				{:else if pending(draftPdf?.status)}<span role="status">PDF szkicu w przygotowaniu…</span>
				{:else if draftPdf?.status === 'failed'}
					<button class={button} disabled={busy} onclick={() => act('retry-draft', async (key) => {
						if (!draftPdf) return;
						await getQuoteClient().retryQuotePdf({ quoteId: id, draftVersion: draftPdf.draftVersion, idempotencyKey: key });
					}, false)}>Ponów PDF szkicu</button>
				{/if}
				{#if pending(currentPdf?.status)}<span role="status">PDF najnowszej rewizji w przygotowaniu…</span>
				{:else if currentPdf?.status === 'failed'}<span role="status">PDF najnowszej rewizji wymaga ponowienia.</span>{/if}
				{#if publishedPdf?.url}<button class={primary} onclick={() => download(0n)}>Pobierz najnowszy gotowy PDF</button>{/if}
			</div>
			{#if preview}<iframe title="Podgląd wyceny" sandbox="" srcdoc={preview} class="h-[70vh] w-full rounded bg-white"></iframe>{/if}
			{#if revisions.length}
				<h3 class="font-semibold">Historia rewizji</h3>
				<ul class="divide-y divide-border-line">
					{#each revisions as revision (revision.revision)}
						<li class="flex flex-wrap items-center gap-2 py-2">
							<span class="mr-auto">v{revision.revision} · {new Date(revision.publishedAt).toLocaleString('pl-PL')}</span>
							<button class={button} onclick={() => showPreview(revision.revision)}>Podgląd</button>
							<button class={button} onclick={() => download(revision.revision)}>Pobierz PDF</button>
							<button class={button} disabled={busy} onclick={() => act(`retry:${revision.revision}`, async (key) => {
								await getQuoteClient().retryQuotePdf({ quoteId: id, revision: revision.revision, idempotencyKey: key });
							}, false)}>Ponów PDF</button>
						</li>
					{/each}
				</ul>
				{#if revisionOffset > 0}<button class={button} onclick={() => loadRevisions(revisionOffset - 20)}>Nowsze</button>{/if}
				{#if revisions.length === 20}<button class={button} onclick={() => loadRevisions(revisionOffset + 20)}>Starsze</button>{/if}
			{/if}
		</div>
	{/if}
</section>
