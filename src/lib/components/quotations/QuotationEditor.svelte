<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Check, DownloadSimple, MagicWand, WarningCircle } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { QuotationAutosave } from '$lib/quotations/autosave.svelte';
	import { estimateQuotationAiCost } from '$lib/quotations/cost';
	import { quotationDocumentToUpdatePayload } from '$lib/quotations/document';
	import type { QuotationModelPrice } from '$lib/quotations/types';
	import QuotationBlocksEditor from './QuotationBlocksEditor.svelte';
	import QuotationItemsEditor from './QuotationItemsEditor.svelte';
	import QuotationLetterheadSelector from './QuotationLetterheadSelector.svelte';
	import QuotationModelSelector from './QuotationModelSelector.svelte';
	import QuotationPreview from './QuotationPreview.svelte';

	type AnyRecord = Record<string, any>;
	function cloneJson<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}
	type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
	type Props = {
		quotation: AnyRecord;
		letterheads?: AnyRecord[];
		models?: AnyRecord[];
		usage?: AnyRecord | null;
		operations?: AnyRecord[];
		versions?: AnyRecord[];
	};
	let {
		quotation: initialQuotation,
		letterheads = [],
		models = [],
		usage = null,
		operations = [],
		versions = []
	}: Props = $props();
	let quotation = $state(untrack(() => cloneJson(initialQuotation)));
	let document = $state(untrack(() => cloneJson(initialQuotation.document)));
	let errorMessage = $state('');
	let selectedModel = $state(
		untrack(() => models.find((model) => model.recommended)?.id ?? models[0]?.id ?? '')
	);
	let aiInstructions = $state('');
	let aiBusy = $state(false);
	let revisingId = $state('');
	let approving = $state(false);
	let useAsAiExample = $state(true);
	let saveVerifiedProductDescriptions = $state(true);
	let undoDocument = $state<AnyRecord | null>(null);
	let revision = $state(untrack(() => initialQuotation.lockVersion ?? 0));
	let letterheadOptions = $derived(letterheads as any);
	let modelOptions = $derived(models as any);
	let editable = $derived(quotation.status !== 'archived');
	const autosave = new QuotationAutosave<AnyRecord>({
		initialDocument: untrack(() => cloneJson(document)),
		initialLockVersion: untrack(() => quotation.lockVersion),
		debounceMs: 1_000,
		save: async (pendingDocument, expectedLockVersion, signal) => {
			const payload = await api(`/api/quotations/${encodeURIComponent(quotation.id)}`, {
				method: 'PATCH',
				signal,
				body: JSON.stringify({
					...quotationDocumentToUpdatePayload(pendingDocument as any, expectedLockVersion),
					knowledgeEnabled: quotation.knowledgeEnabled ?? true
				})
			});
			const item = payload.item ?? payload.quotation ?? payload;
			quotation = { ...quotation, ...item, document: quotation.document };
			revision = item.lockVersion;
			return { document: item.document, lockVersion: item.lockVersion };
		}
	});
	let saveState = $derived.by((): SaveState => {
		if (autosave.status === 'idle') return 'saved';
		return autosave.status;
	});
	let displayedError = $derived(errorMessage || autosave.error?.message || '');
	let estimatedCostUsd = $derived.by(() => {
		const model = models.find((entry) => entry.id === selectedModel);
		if (!model) return null;
		const estimate = estimateQuotationAiCost(model as QuotationModelPrice);
		return estimate ? estimate.totalCostUsdMicros / 1_000_000 : null;
	});

	onMount(() => {
		const savedModel = window.localStorage.getItem('blokserwis:quotation-ai-model');
		if (
			savedModel &&
			models.some((model) => model.id === savedModel && model.available !== false)
		) {
			selectedModel = savedModel;
		}
	});
	onDestroy(() => autosave.dispose());

	function idempotencyKey() {
		return crypto.randomUUID();
	}
	function selectModel(value: string) {
		selectedModel = value;
		window.localStorage.setItem('blokserwis:quotation-ai-model', value);
	}
	function recordAiUsage(operation: AnyRecord | undefined) {
		const cost = operation?.usage?.costUsdMicros;
		if (!operation || typeof cost !== 'number') return;
		usage = {
			...(usage ?? {}),
			quotationCostUsdMicros: (usage?.quotationCostUsdMicros ?? 0) + cost,
			monthCostUsdMicros: (usage?.monthCostUsdMicros ?? 0) + cost,
			operations: (usage?.operations ?? 0) + 1
		};
		operations = [operation, ...operations];
	}
	function acceptServerMutation(item: AnyRecord) {
		quotation = item;
		document = cloneJson(item.document);
		autosave.replaceFromServer(cloneJson(item.document), item.lockVersion);
		revision = item.lockVersion;
	}
	function markDirty() {
		if (quotation.status === 'archived') return;
		autosave.schedule(cloneJson($state.snapshot(document)));
	}
	function replaceDocument(next: AnyRecord, shouldSave = true) {
		document = cloneJson(next);
		if (shouldSave) markDirty();
	}
	async function api(path: string, init?: RequestInit) {
		const response = await fetch(path, {
			...init,
			headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			const apiError = new Error(
				payload.message ??
					payload.error?.message ??
					(typeof payload.error === 'string' ? payload.error : 'Operacja nie powiodła się.')
			) as Error & { status?: number; code?: string; details?: unknown; payload?: AnyRecord };
			apiError.status = response.status;
			apiError.code = payload.error?.code;
			apiError.details = payload.error?.details;
			apiError.payload = payload;
			throw apiError;
		}
		return payload;
	}
	async function save() {
		await autosave.flush();
		while (autosave.status === 'saving' || autosave.status === 'dirty') {
			await new Promise((resolve) => setTimeout(resolve, 20));
			await autosave.flush();
		}
	}
	async function loadServerVersion() {
		try {
			const latest = await api(`/api/quotations/${encodeURIComponent(quotation.id)}`);
			const item = latest.item ?? latest.quotation ?? latest;
			quotation = item;
			document = cloneJson(item.document);
			revision = item.lockVersion;
			autosave.resolveWithServer(item.document, item.lockVersion);
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Nie udało się pobrać wersji serwera.';
		}
	}
	async function applyLocalOnLatest() {
		try {
			const latest = await api(`/api/quotations/${encodeURIComponent(quotation.id)}`);
			const item = latest.item ?? latest.quotation ?? latest;
			quotation = { ...quotation, ...item, document: quotation.document };
			autosave.resolveWithLocal(item.lockVersion);
			await save();
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Nie udało się pobrać wersji serwera.';
		}
	}
	async function generate() {
		if (!selectedModel || aiBusy) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		aiBusy = true;
		errorMessage = '';
		undoDocument = cloneJson($state.snapshot(document));
		try {
			const payload = await api(`/api/quotations/${encodeURIComponent(quotation.id)}/ai/generate`, {
				method: 'POST',
				body: JSON.stringify({
					modelId: selectedModel,
					instructions: aiInstructions || undefined,
					expectedLockVersion: quotation.lockVersion,
					idempotencyKey: idempotencyKey()
				})
			});
			acceptServerMutation(payload.item ?? payload.quotation ?? payload);
			recordAiUsage(payload.operation);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Generowanie nie powiodło się.';
			undoDocument = null;
		} finally {
			aiBusy = false;
		}
	}
	async function revise(blockId: string, feedback: string) {
		if (!selectedModel || revisingId) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		revisingId = blockId;
		errorMessage = '';
		undoDocument = cloneJson($state.snapshot(document));
		try {
			const payload = await api(
				`/api/quotations/${encodeURIComponent(quotation.id)}/ai/revise-block`,
				{
					method: 'POST',
					body: JSON.stringify({
						modelId: selectedModel,
						blockId,
						feedback,
						expectedLockVersion: quotation.lockVersion,
						idempotencyKey: idempotencyKey()
					})
				}
			);
			acceptServerMutation(payload.item ?? payload.quotation ?? payload);
			recordAiUsage(payload.operation);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Poprawa bloku nie powiodła się.';
			undoDocument = null;
		} finally {
			revisingId = '';
		}
	}
	function undoAi() {
		if (!undoDocument) return;
		const previous = undoDocument;
		undoDocument = null;
		replaceDocument(previous);
	}
	async function approve() {
		if (approving) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		approving = true;
		errorMessage = '';
		try {
			const payload = await api(`/api/quotations/${encodeURIComponent(quotation.id)}/approve`, {
				method: 'POST',
				body: JSON.stringify({
					expectedLockVersion: quotation.lockVersion,
					useAsAiExample,
					saveVerifiedProductDescriptions,
					idempotencyKey: idempotencyKey()
				})
			});
			acceptServerMutation(payload.item ?? payload.quotation ?? payload);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Nie udało się zatwierdzić wyceny.';
		} finally {
			approving = false;
		}
	}
	function exportUrl(format: 'pdf' | 'docx') {
		return `/api/quotations/${encodeURIComponent(quotation.id)}/export/${format}?lockVersion=${quotation.lockVersion}`;
	}
</script>

<svelte:head
	><title>{document.title} — Wyceny</title><meta
		name="description"
		content="Edycja i generowanie wyceny Blokserwis."
	/></svelte:head
>

<div class="mx-auto max-w-[1500px] space-y-5 pb-24 lg:pb-6">
	<header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<a href="/wyceny" class="text-sm font-medium text-primary hover:underline">Wróć do wycen</a>
			<div class="mt-2 flex flex-wrap items-center gap-2">
				<h1 class="text-2xl font-bold tracking-tight text-text-main">
					{document.number ?? 'Szkic wyceny'}
				</h1>
				<span
					class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-text-muted dark:bg-zinc-800"
					>{quotation.status === 'approved'
						? 'Zatwierdzona'
						: quotation.status === 'archived'
							? 'Archiwalna'
							: 'Szkic'}</span
				>
			</div>
			<p class="mt-1 text-xs text-text-muted" aria-live="polite">
				{saveState === 'saved'
					? 'Wszystkie zmiany zapisane'
					: saveState === 'dirty'
						? 'Niezapisane zmiany…'
						: saveState === 'saving'
							? 'Zapisywanie…'
							: saveState === 'conflict'
								? 'Konflikt wersji'
								: 'Błąd zapisu'}
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a
				href={exportUrl('pdf')}
				class="inline-flex h-10 items-center gap-2 rounded-md border border-border-line bg-bg-panel px-3 text-sm font-medium text-text-main hover:bg-bg-app"
				><DownloadSimple class="h-4 w-4" /> PDF</a
			><a
				href={exportUrl('docx')}
				class="inline-flex h-10 items-center gap-2 rounded-md border border-border-line bg-bg-panel px-3 text-sm font-medium text-text-main hover:bg-bg-app"
				><DownloadSimple class="h-4 w-4" /> DOCX</a
			>
		</div>
	</header>
	{#if displayedError}<div
			class="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
		>
			<WarningCircle class="mt-0.5 h-5 w-5 shrink-0" />
			<p>{displayedError}</p>
		</div>{/if}
	{#if saveState === 'conflict'}<div
			class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
		>
			<p class="font-medium">Ta wycena zmieniła się w innej karcie lub przez inną osobę.</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<Button variant="secondary" size="sm" onclick={loadServerVersion}
					>Wczytaj wersję serwera</Button
				><Button size="sm" onclick={applyLocalOnLatest}>Zastosuj moje zmiany na najnowszej</Button>
			</div>
		</div>{/if}
	<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.8fr)]">
		<main class="min-w-0 space-y-4">
			<section class="space-y-4 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5">
				<h2 class="font-semibold text-text-main">Dane wyceny</h2>
				<label class="grid gap-1 text-sm font-medium text-text-main"
					>Tytuł<input
						disabled={!editable}
						value={document.title}
						oninput={(event) => {
							document.title = event.currentTarget.value;
							markDirty();
						}}
						class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-text-main"
					/></label
				>
				<div class="grid gap-3 sm:grid-cols-2">
					<label class="grid gap-1 text-xs text-text-muted"
						>Firma klienta<input
							disabled={!editable}
							value={document.customer?.companyName ?? ''}
							oninput={(event) => {
								document.customer.companyName = event.currentTarget.value;
								markDirty();
							}}
							class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
						/></label
					><label class="grid gap-1 text-xs text-text-muted"
						>Osoba kontaktowa<input
							disabled={!editable}
							value={document.customer?.contactName ?? ''}
							oninput={(event) => {
								document.customer.contactName = event.currentTarget.value;
								markDirty();
							}}
							class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
						/></label
					><label class="grid gap-1 text-xs text-text-muted"
						>E-mail<input
							disabled={!editable}
							type="email"
							value={document.customer?.email ?? ''}
							oninput={(event) => {
								document.customer.email = event.currentTarget.value;
								markDirty();
							}}
							class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
						/></label
					><label class="grid gap-1 text-xs text-text-muted"
						>Telefon<input
							disabled={!editable}
							value={document.customer?.phone ?? ''}
							oninput={(event) => {
								document.customer.phone = event.currentTarget.value;
								markDirty();
							}}
							class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
						/></label
					><label class="grid gap-1 text-xs text-text-muted sm:col-span-2"
						>Adres<input
							disabled={!editable}
							value={document.customer?.address ?? ''}
							oninput={(event) => {
								document.customer.address = event.currentTarget.value;
								markDirty();
							}}
							class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
						/></label
					>
				</div>
				<label class="grid gap-1 text-xs text-text-muted"
					>Wprowadzenie<textarea
						disabled={!editable}
						value={document.introduction}
						oninput={(event) => {
							document.introduction = event.currentTarget.value;
							markDirty();
						}}
						rows="3"
						class="rounded-md border border-border-line bg-bg-app p-3 text-sm leading-6 text-text-main"
					></textarea></label
				><QuotationLetterheadSelector
					value={document.letterheadVariant}
					letterheads={letterheadOptions}
					disabled={!editable}
					onchange={(value) => {
						document.letterheadVariant = value;
						markDirty();
					}}
				/>
			</section>
			<QuotationItemsEditor
				categories={document.categories}
				items={document.items}
				disabled={!editable}
				onchange={(categories, items) => {
					document.categories = categories;
					document.items = items;
					markDirty();
				}}
			/>
			<QuotationBlocksEditor
				blocks={document.descriptionBlocks}
				disabled={!editable}
				{revisingId}
				canUndo={undoDocument !== null}
				onchange={(blocks) => {
					document.descriptionBlocks = blocks;
					markDirty();
				}}
				onrevise={revise}
				onundo={undoAi}
			/>
			<section class="space-y-3 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5">
				<h2 class="font-semibold text-text-main">Asystent AI</h2>
				<QuotationModelSelector
					models={modelOptions}
					value={selectedModel}
					{usage}
					{estimatedCostUsd}
					onchange={selectModel}
				/><textarea
					bind:value={aiInstructions}
					disabled={!editable}
					rows="3"
					placeholder="Dodatkowe wskazówki, np. podkreśl szybki termin realizacji…"
					class="w-full rounded-md border border-border-line bg-bg-app p-3 text-sm text-text-main"
				></textarea><Button
					loading={aiBusy}
					disabled={!selectedModel || !editable}
					onclick={generate}><MagicWand class="mr-2 h-4 w-4" /> Generuj kompletny opis</Button
				>
				{#if operations.length > 0}
					<details
						class="rounded-md border border-border-line bg-bg-app p-3 text-xs text-text-muted"
					>
						<summary class="cursor-pointer font-medium text-text-main"
							>Historia AI ({operations.length})</summary
						>
						<ul class="mt-2 space-y-1">
							{#each operations.slice(0, 5) as operation (operation.id)}
								<li>{operation.operationType} · {operation.modelId} · {operation.status}</li>
							{/each}
						</ul>
					</details>
				{/if}
				{#if versions.length > 0}<p class="text-xs text-text-muted">
						Zapisane wersje dokumentu: {versions.length}
					</p>{/if}
			</section>
			{#if editable}<section
					class="space-y-3 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5"
				>
					<h2 class="font-semibold text-text-main">Zatwierdzenie</h2>
					<p class="text-sm text-text-muted">
						{quotation.status === 'approved'
							? 'Ponowne zatwierdzenie utrwali zmiany i zachowa dotychczasowy numer.'
							: 'Zatwierdzenie nada numer dokumentu i utrwali wersję PDF/DOCX.'}
					</p>
					<label class="flex items-start gap-2 text-sm text-text-main"
						><input
							type="checkbox"
							bind:checked={useAsAiExample}
							class="mt-0.5 file-selection-checkbox"
						/> Użyj tej wyceny jako zweryfikowanego przykładu dla AI</label
					><label class="flex items-start gap-2 text-sm text-text-main"
						><input
							type="checkbox"
							bind:checked={saveVerifiedProductDescriptions}
							class="mt-0.5 file-selection-checkbox"
						/> Zapisz zatwierdzone opisy produktów jako wiedzę</label
					><Button loading={approving} disabled={saveState !== 'saved'} onclick={approve}
						><Check class="mr-2 h-4 w-4" />
						{quotation.status === 'approved'
							? 'Zatwierdź zmiany ponownie'
							: 'Zatwierdź i nadaj numer'}</Button
					>
				</section>{/if}
		</main>
		<aside class="min-w-0 xl:sticky xl:top-4 xl:self-start">
			<QuotationPreview quotationId={quotation.id} {revision} title={document.title} />
		</aside>
	</div>
	<div
		class="fixed inset-x-0 bottom-0 z-30 border-t border-border-line bg-bg-panel/95 p-3 backdrop-blur lg:hidden"
	>
		<div class="mx-auto flex max-w-6xl gap-2">
			<a
				href={exportUrl('pdf')}
				class="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border-line text-sm font-medium text-text-main"
				>PDF</a
			>{#if editable}<Button
					class="flex-1"
					disabled={saveState !== 'saved'}
					loading={approving}
					onclick={approve}>Zatwierdź</Button
				>{/if}
		</div>
	</div>
</div>
