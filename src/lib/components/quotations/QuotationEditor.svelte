<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import type {
		Quotation,
		QuotationAiMutationResponse,
		QuotationAiOperation,
		QuotationDocument,
		QuotationLetterhead,
		QuotationVersion
	} from '@unisource/sdk/v2';
	import {
		Check,
		DownloadSimple,
		Eye,
		MagicWand,
		PencilSimple,
		WarningCircle
	} from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { QuotationAutosave } from '$lib/quotations/autosave.svelte';
	import { consumeQuotationAiStream, type QuotationAiStreamEvent } from '$lib/quotations/ai-stream';
	import { quotationDocumentToUpdatePayload } from '$lib/quotations/document';
	import { QUOTATION_AI_MODEL_ID } from '$lib/quotations/models';
	import type { QuotationModelPrice } from '$lib/quotations/types';
	import QuotationBlocksEditor from './QuotationBlocksEditor.svelte';
	import QuotationItemsEditor from './QuotationItemsEditor.svelte';
	import QuotationLetterheadSelector from './QuotationLetterheadSelector.svelte';
	import QuotationPreview from './QuotationPreview.svelte';
	import CollapsibleSection from '$lib/components/ui/CollapsibleSection.svelte';

	function cloneJson<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}
	type ApiPayload = Record<string, unknown> & {
		item?: Quotation;
		quotation?: Quotation;
		message?: unknown;
		error?: unknown;
	};
	type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
	type Props = {
		quotation: Quotation;
		letterheads?: QuotationLetterhead[];
		operations?: QuotationAiOperation[];
		versions?: QuotationVersion[];
		models?: QuotationModelPrice[];
	};
	let {
		quotation: initialQuotation,
		letterheads = [],
		operations = [],
		versions = [],
		models = []
	}: Props = $props();
	let quotation = $state<Quotation>(untrack(() => cloneJson(initialQuotation)));
	let document = $state<QuotationDocument>(untrack(() => cloneJson(initialQuotation.document)));
	let errorMessage = $state('');
	let aiInstructions = $state('');
	let documentFeedback = $state('');
	let manualModelId = $state('');
	let manualReasoningEnabled = $state(false);
	let aiBusy = $state(false);
	let documentRevisionBusy = $state(false);
	let webSearchEnabled = $state(true);
	let aiStatus = $state('');
	let aiReasoning = $state('');
	let aiRawResponse = $state('');
	let aiActivity = $state<Array<{ id: string; text: string; completed: boolean }>>([]);
	let aiSources = $state<Array<{ title: string; url: string; description?: string }>>([]);
	let aiFieldPreviews = $state<Record<string, { label: string; value: string }>>({});
	let aiAbortController: AbortController | null = null;
	let revisingId = $state('');
	let approving = $state(false);
	let mobilePreviewOpen = $state(true);
	let useAsAiExample = $state(true);
	let saveVerifiedProductDescriptions = $state(true);
	let undoDocument = $state<QuotationDocument | null>(null);
	let revision = $state(untrack(() => initialQuotation.lockVersion ?? 0));
	let letterheadOptions = $derived(letterheads);
	const retryStoragePrefix = `chmura:quotation-v2:${untrack(() => initialQuotation.id)}:`;
	let editable = $derived(quotation.status !== 'archived');
	const autosave = new QuotationAutosave<QuotationDocument>({
		initialDocument: untrack(() => cloneJson(document)),
		initialLockVersion: untrack(() => quotation.lockVersion),
		debounceMs: 1_000,
		save: async (pendingDocument, expectedLockVersion, signal) => {
			const payload = await api(`/api/quotations/${encodeURIComponent(quotation.id)}`, {
				method: 'PATCH',
				signal,
				body: JSON.stringify({
					...quotationDocumentToUpdatePayload(pendingDocument, expectedLockVersion),
					knowledgeEnabled: quotation.knowledgeEnabled ?? true
				})
			});
			const item = quotationFromPayload(payload);
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
	onDestroy(() => {
		aiAbortController?.abort();
		autosave.dispose();
	});

	let aiRetryKeys = $state<Record<string, string>>({});
	function readRetryKey(scope: string): string | null {
		if (typeof window === 'undefined') return null;
		try {
			return window.localStorage.getItem(`${retryStoragePrefix}${scope}`);
		} catch {
			return null;
		}
	}
	function writeRetryKey(scope: string, value: string): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(`${retryStoragePrefix}${scope}`, value);
		} catch {
			// Storage is an optional resilience layer.
		}
	}
	function removeRetryKey(scope: string): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.removeItem(`${retryStoragePrefix}${scope}`);
		} catch {
			// Storage cleanup is best effort.
		}
	}
	function idempotencyKey(scope = 'generic') {
		const existing = aiRetryKeys[scope] ?? readRetryKey(scope);
		if (existing) return existing;
		const next = crypto.randomUUID();
		aiRetryKeys = { ...aiRetryKeys, [scope]: next };
		writeRetryKey(scope, next);
		return next;
	}
	function clearIdempotencyKey(scope: string) {
		if (scope in aiRetryKeys) {
			const next = { ...aiRetryKeys };
			delete next[scope];
			aiRetryKeys = next;
		}
		removeRetryKey(scope);
	}
	function shouldRotateIdempotencyKey(error: unknown): boolean {
		if (!error || typeof error !== 'object') return false;
		const code = (error as { code?: unknown }).code;
		return typeof code === 'string' && (code === 'conflict' || code.startsWith('quotation_'));
	}
	function recordAiUsage(operation: QuotationAiOperation | undefined) {
		if (!operation) return;
		operations = [operation, ...operations];
	}
	function acceptServerMutation(item: Quotation) {
		quotation = item;
		document = cloneJson(item.document);
		autosave.replaceFromServer(cloneJson(item.document), item.lockVersion);
		revision = item.lockVersion;
	}
	function quotationFromPayload(payload: ApiPayload | QuotationAiMutationResponse): Quotation {
		if ('item' in payload && payload.item) return payload.item;
		if ('quotation' in payload && payload.quotation) return payload.quotation;
		return payload as unknown as Quotation;
	}
	function markDirty() {
		if (quotation.status === 'archived') return;
		autosave.schedule(cloneJson($state.snapshot(document)));
	}
	function replaceDocument(next: QuotationDocument, shouldSave = true) {
		document = cloneJson(next);
		if (shouldSave) markDirty();
	}
	async function api<T extends ApiPayload = ApiPayload>(path: string, init?: RequestInit): Promise<T> {
		const response = await fetch(path, {
			...init,
			headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
		});
		const payload = (await response.json().catch(() => ({}))) as T;
		if (!response.ok) {
			const nestedError = payload.error && typeof payload.error === 'object' && !Array.isArray(payload.error)
				? (payload.error as { message?: unknown; code?: unknown; details?: unknown })
				: undefined;
			const apiError = new Error(
				typeof payload.message === 'string'
					? payload.message
					: typeof nestedError?.message === 'string'
						? nestedError.message
						: typeof payload.error === 'string'
							? payload.error
							: 'Operacja nie powiodła się.'
			) as Error & { status?: number; code?: string; details?: unknown; payload?: ApiPayload };
			apiError.status = response.status;
			apiError.code = typeof nestedError?.code === 'string' ? nestedError.code : undefined;
			apiError.details = nestedError?.details;
			apiError.payload = payload;
			throw apiError;
		}
		return payload;
	}
	function resetAiStream() {
		aiStatus = 'Uruchamiam asystenta AI';
		aiReasoning = '';
		aiRawResponse = '';
		aiActivity = [];
		aiSources = [];
		aiFieldPreviews = {};
	}
	function aiSelection() {
		const modelId = manualModelId.trim();
		return modelId
			? {
					mode: 'custom' as const,
					modelId,
					reasoningEnabled: manualReasoningEnabled,
					webSearchEnabled
				}
			: { mode: 'automatic' as const };
	}
	function addAiActivity(text: string, completed = false) {
		aiActivity = [...aiActivity.slice(-11), { id: crypto.randomUUID(), text, completed }];
	}
	function previewLabel(event: Extract<QuotationAiStreamEvent, { type: 'field.preview' }>) {
		if (event.field === 'introduction') return 'Wprowadzenie';
		if (event.field === 'revision') return 'Poprawiona treść';
		if (event.field === 'item_description') {
			return (
			document.items.find((item) => item.id === event.itemId)?.name ?? 'Opis pozycji'
			);
		}
		return event.field === 'block_title'
			? `Tytuł bloku ${(event.blockIndex ?? 0) + 1}`
			: `Treść bloku ${(event.blockIndex ?? 0) + 1}`;
	}
	function handleAiEvent(event: QuotationAiStreamEvent) {
		switch (event.type) {
			case 'status':
				aiStatus = event.message;
				addAiActivity(event.message);
				break;
			case 'web_search.started':
				aiStatus = `Szukam: ${event.itemName}`;
				addAiActivity(`Przeszukuję internet: ${event.itemName}`);
				break;
			case 'web_search.completed':
				addAiActivity(
					event.sources.length > 0
						? `Znaleziono ${event.sources.length} źródła dla: ${event.itemName}`
						: `Brak wiarygodnych wyników dla: ${event.itemName}`,
					true
				);
				for (const source of event.sources) {
					if (!aiSources.some((entry) => entry.url === source.url)) aiSources.push(source);
				}
				break;
			case 'reasoning.delta':
				aiReasoning = (aiReasoning + event.delta).slice(-30_000);
				break;
			case 'content.delta':
				aiRawResponse = (aiRawResponse + event.delta).slice(-50_000);
				break;
			case 'field.preview': {
				const key = `${event.field}:${event.itemId ?? event.blockIndex ?? 'root'}`;
				aiFieldPreviews[key] = { label: previewLabel(event), value: event.value };
				break;
			}
			case 'attempt.reset':
				aiReasoning = '';
				aiRawResponse = '';
				aiFieldPreviews = {};
				addAiActivity(`Ponawiam generowanie — próba ${event.attempt}`);
				break;
			case 'done':
				aiStatus = 'Wygenerowana wersja została zapisana';
				addAiActivity('Wygenerowana wersja została zapisana', true);
				break;
		}
	}
	async function streamApi(path: string, body: Record<string, unknown>): Promise<QuotationAiMutationResponse> {
		aiAbortController = new AbortController();
		const response = await fetch(path, {
			method: 'POST',
			signal: aiAbortController.signal,
			headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
			body: JSON.stringify(body)
		});
		return (await consumeQuotationAiStream(response, handleAiEvent)) as unknown as QuotationAiMutationResponse;
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
			const item = quotationFromPayload(latest);
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
			const item = quotationFromPayload(latest);
			quotation = { ...quotation, ...item, document: quotation.document };
			autosave.resolveWithLocal(item.lockVersion);
			await save();
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Nie udało się pobrać wersji serwera.';
		}
	}
	async function generate() {
		if (aiBusy) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		aiBusy = true;
		errorMessage = '';
		resetAiStream();
		undoDocument = cloneJson($state.snapshot(document));
		try {
			const payload = await streamApi(
				`/api/quotations/${encodeURIComponent(quotation.id)}/ai/generate`,
				{
					selection: aiSelection(),
					instructions: aiInstructions || undefined,
					expectedLockVersion: quotation.lockVersion,
					idempotencyKey: idempotencyKey('generate')
				}
			);
			acceptServerMutation(quotationFromPayload(payload));
			recordAiUsage(payload.operation);
			clearIdempotencyKey('generate');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Generowanie nie powiodło się.';
			if (shouldRotateIdempotencyKey(error)) clearIdempotencyKey('generate');
			undoDocument = null;
		} finally {
			aiAbortController = null;
			aiBusy = false;
		}
	}
	async function reviseDocument() {
		const feedback = documentFeedback.trim();
		if (!feedback || documentRevisionBusy || !editable) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		documentRevisionBusy = true;
		errorMessage = '';
		resetAiStream();
		undoDocument = cloneJson($state.snapshot(document));
		try {
			const payload = await streamApi(
				`/api/quotations/${encodeURIComponent(quotation.id)}/ai/revise-document`,
				{
					selection: aiSelection(),
					feedback,
					expectedLockVersion: quotation.lockVersion,
					idempotencyKey: idempotencyKey('revise-document')
				}
			);
			acceptServerMutation(quotationFromPayload(payload));
			recordAiUsage(payload.operation);
			documentFeedback = '';
			clearIdempotencyKey('revise-document');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Poprawa wyceny nie powiodła się.';
			if (shouldRotateIdempotencyKey(error)) clearIdempotencyKey('revise-document');
		} finally {
			aiAbortController = null;
			documentRevisionBusy = false;
		}
	}
	async function revise(blockId: string, feedback: string) {
		if (revisingId) return;
		if (saveState !== 'saved') await save();
		if (saveState !== 'saved') return;
		revisingId = blockId;
		errorMessage = '';
		resetAiStream();
		undoDocument = cloneJson($state.snapshot(document));
		try {
			const payload = await streamApi(
				`/api/quotations/${encodeURIComponent(quotation.id)}/ai/revise-block`,
				{
					modelId: manualModelId.trim() || QUOTATION_AI_MODEL_ID,
					reasoningEnabled: false,
					webSearchEnabled,
					blockId,
					feedback,
					expectedLockVersion: quotation.lockVersion,
					idempotencyKey: idempotencyKey(`revise-block:${blockId}`)
				}
			);
			acceptServerMutation(quotationFromPayload(payload));
			recordAiUsage(payload.operation);
			clearIdempotencyKey(`revise-block:${blockId}`);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Poprawa bloku nie powiodła się.';
			if (shouldRotateIdempotencyKey(error)) clearIdempotencyKey(`revise-block:${blockId}`);
			undoDocument = null;
		} finally {
			aiAbortController = null;
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
					idempotencyKey: idempotencyKey('approve')
				})
			});
			acceptServerMutation(quotationFromPayload(payload));
			clearIdempotencyKey('approve');
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Nie udało się zatwierdzić wyceny.';
			if (shouldRotateIdempotencyKey(error)) clearIdempotencyKey('approve');
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
	<section class="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-4 sm:p-5">
		<div>
			<h2 class="font-semibold text-text-main">Podgląd i szybka poprawka</h2>
			<p class="mt-1 text-sm text-text-muted">
				Podgląd dokumentu jest po prawej. Napisz, co zmienić w narracji — ilości, jednostki i ceny pozostaną bez zmian.
			</p>
		</div>
		<label class="grid gap-1 text-sm font-medium text-text-main" for="document-feedback"
			>Co poprawić?<textarea
				id="document-feedback"
				bind:value={documentFeedback}
				disabled={!editable || documentRevisionBusy || aiBusy || Boolean(revisingId)}
				rows="3"
				placeholder="Np. skróć wprowadzenie i podkreśl szybki termin realizacji…"
				class="rounded-md border border-border-line bg-bg-panel p-3 text-sm font-normal leading-6 text-text-main"
			></textarea>
		</label>
		<div class="flex flex-wrap items-center gap-2">
			<Button
				loading={documentRevisionBusy}
				disabled={!editable || !documentFeedback.trim() || documentRevisionBusy || aiBusy || Boolean(revisingId)}
				onclick={reviseDocument}
				><MagicWand class="mr-2 h-4 w-4" /> Popraw z AI</Button
			>
			{#if undoDocument}
				<Button variant="secondary" disabled={documentRevisionBusy || aiBusy} onclick={undoAi}>Cofnij ostatnią zmianę</Button>
			{/if}
		</div>
	</section>
	<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,0.8fr)]">
		<main class="min-w-0 space-y-4 {mobilePreviewOpen ? 'hidden' : 'block'} xl:block">
			<section class="space-y-4 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5">
				<h2 class="font-semibold text-text-main">Podstawowe dane</h2>
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
			</section>
			<CollapsibleSection
				title="Klient i wprowadzenie"
				description="Dane odbiorcy oraz tekst otwierający dokument."
				open={false}
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
				>
			</CollapsibleSection>
			<CollapsibleSection
				title="Pozycje i kategorie"
				description="Ilości i ceny są chronione przed globalną poprawką AI."
				open={false}
			>
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
			</CollapsibleSection>
			<CollapsibleSection
				title="Bloki opisu"
				description="Opis zakresu, standardu i korzyści dla klienta."
				open={false}
			>
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
			</CollapsibleSection>

			<CollapsibleSection
				title="Ustawienia dokumentu"
				description="Papier firmowy i szablony wydruku."
				open={false}
			>
				<QuotationLetterheadSelector
					value={document.letterheadVariant}
					letterheads={letterheadOptions}
					disabled={!editable}
					onchange={(value) => {
						document.letterheadVariant = value;
						markDirty();
					}}
				/>
			</CollapsibleSection>

			<CollapsibleSection
				title="Asystent AI"
				description="Generowanie i poprawianie treści z pomocą AI."
				open={false}
			>
				{#if models.length > 0}
					<label class="grid gap-1 rounded-md border border-border-line bg-bg-app p-3 text-sm text-text-main">
						<span class="font-medium">Model AI (opcje zaawansowane)</span>
						<select
							value={manualModelId}
							disabled={!editable || aiBusy || documentRevisionBusy || Boolean(revisingId)}
							onchange={(event) => {
								manualModelId = event.currentTarget.value;
								if (!models.find((model) => model.id === manualModelId)?.reasoningSupported) {
									manualReasoningEnabled = false;
								}
							}}
							class="h-10 rounded-md border border-border-line bg-bg-panel px-3 text-sm text-text-main"
						>
							<option value="">Automatyczny dobór (zalecany)</option>
							{#each models.filter((model) => model.available !== false) as model (model.id)}
								<option value={model.id}>{model.name}</option>
							{/each}
						</select>
						<span class="text-xs text-text-muted">
							Domyślnie backend dobiera model, research i reasoning. Ręczny wybór działa tylko dla tej wyceny.
						</span>
					</label>
					{#if manualModelId}
						<label class="flex items-start gap-2 rounded-md border border-border-line bg-bg-app p-3 text-sm text-text-main">
							<input
								type="checkbox"
								bind:checked={manualReasoningEnabled}
								disabled={!editable || aiBusy || documentRevisionBusy || Boolean(revisingId) || !models.find((model) => model.id === manualModelId)?.reasoningSupported}
								class="mt-0.5 file-selection-checkbox"
							/>
							<span>
								<span class="block font-medium">Reasoning dla wybranego modelu</span>
								<span class="mt-0.5 block text-xs text-text-muted">Może poprawić jakość, ale zwiększa czas i koszt generowania.</span>
							</span>
						</label>
					{/if}
				{/if}
				<label
					class="flex items-start gap-2 rounded-md border border-border-line bg-bg-app p-3 text-sm text-text-main"
				>
					<input
						type="checkbox"
						bind:checked={webSearchEnabled}
						disabled={!editable || aiBusy || Boolean(revisingId)}
						class="mt-0.5 file-selection-checkbox"
					/>
					<span>
						<span class="block font-medium">Aktualny research internetowy</span>
						<span class="mt-0.5 block text-xs text-text-muted">
							Sprawdza modele urządzeń w Brave Search i przekazuje źródła do generowanego opisu.
						</span>
					</span>
				</label>
				<textarea
					bind:value={aiInstructions}
					disabled={!editable}
					rows="3"
					placeholder="Dodatkowe wskazówki, np. podkreśl szybki termin realizacji…"
					class="w-full rounded-md border border-border-line bg-bg-app p-3 text-sm text-text-main"
				></textarea>
				<Button loading={aiBusy} disabled={!editable} onclick={generate}
					><MagicWand class="mr-2 h-4 w-4" /> Generuj kompletny opis</Button
				>
				{#if aiBusy || aiStatus}
					<div
						class="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-3"
						aria-live="polite"
					>
						<div class="flex items-center gap-2 text-sm font-medium text-text-main">
							<span
								class:animate-pulse={aiBusy || Boolean(revisingId)}
								class="h-2.5 w-2.5 rounded-full bg-primary"
							></span>
							{aiStatus}
						</div>
						{#if aiActivity.length > 0}
							<ul class="space-y-1.5 text-xs text-text-muted">
								{#each aiActivity.slice(-6) as activity (activity.id)}
									<li class="flex gap-2">
										<span class={activity.completed ? 'text-emerald-600' : 'text-primary'}>
											{activity.completed ? '✓' : '●'}
										</span>
										<span>{activity.text}</span>
									</li>
								{/each}
							</ul>
						{/if}
						{#if Object.keys(aiFieldPreviews).length > 0}
							<div class="space-y-2 border-t border-primary/15 pt-3">
								<p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
									Generowana treść
								</p>
								{#each Object.entries(aiFieldPreviews).slice(-6) as [key, preview] (key)}
									<div class="rounded border border-border-line bg-bg-panel p-2.5">
										<p class="mb-1 text-xs font-medium text-text-main">{preview.label}</p>
										<p class="whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
											{preview.value}<span class:animate-pulse={aiBusy}>▍</span>
										</p>
									</div>
								{/each}
							</div>
						{/if}
						{#if aiSources.length > 0}
							<details class="border-t border-primary/15 pt-2 text-xs">
								<summary class="cursor-pointer font-medium text-text-main">
									Źródła internetowe ({aiSources.length})
								</summary>
								<ul class="mt-2 space-y-1.5">
									{#each aiSources as source (source.url)}
										<li>
											<a
												href={source.url}
												target="_blank"
												rel="noreferrer"
												class="font-medium text-primary hover:underline">{source.title}</a
											>
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					</div>
				{/if}
				{#if operations.length > 0}
					<details
						class="rounded-md border border-border-line bg-bg-app p-3 text-xs text-text-muted"
					>
						<summary class="cursor-pointer font-medium text-text-main"
							>Historia AI ({operations.length})</summary
						>
						<ul class="mt-2 space-y-1">
							{#each operations.slice(0, 5) as operation (operation.id)}
								<li>{operation.operationType} · {operation.status}</li>
							{/each}
						</ul>
					</details>
				{/if}
				{#if versions.length > 0}<p class="text-xs text-text-muted">
						Zapisane wersje dokumentu: {versions.length}
					</p>{/if}
			</CollapsibleSection>
			{#if editable}
				<CollapsibleSection title="Zatwierdzenie" description="Zatwierdź dokument i nadaj numer." open={false}>
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
				</CollapsibleSection>{/if}
		</main>
		<aside
			class="min-w-0 {mobilePreviewOpen
				? 'block'
				: 'hidden'} xl:block xl:sticky xl:top-4 xl:self-start"
		>
			<QuotationPreview quotationId={quotation.id} {revision} title={document.title} />
		</aside>
	</div>
	<div
		class="fixed inset-x-0 bottom-0 z-30 border-t border-border-line bg-bg-panel/95 p-3 backdrop-blur xl:hidden"
	>
		<div class="mx-auto flex max-w-6xl gap-2">
			<button
				type="button"
				onclick={() => (mobilePreviewOpen = !mobilePreviewOpen)}
				class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border-line bg-bg-panel text-sm font-medium text-text-main hover:bg-bg-app"
			>
				{#if mobilePreviewOpen}<PencilSimple class="h-4 w-4" /> Edycja{:else}<Eye class="h-4 w-4" /> Podgląd{/if}
			</button>
			{#if !mobilePreviewOpen}
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
			{/if}
		</div>
	</div>
</div>
