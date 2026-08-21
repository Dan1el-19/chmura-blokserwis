<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { FileXls, Keyboard, Plus, WarningCircle, X } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { consumeQuotationAiStream, type QuotationAiStreamEvent } from '$lib/quotations/ai-stream';
	import { importedItemsToQuotationDraft } from '$lib/quotations/document';
	import type {
		ImportedQuotationItem,
		QuotationColumnMapping,
		QuotationImportField,
		QuotationWorkbookImport
	} from '$lib/quotations/types';
	import {
		parseQuotationWorkbook,
		parseQuotationXlsxFile,
		QuotationXlsxImportError
	} from '$lib/quotations/xlsx-parser';

	type Mode = 'import' | 'manual';
	type EditableField = 'name' | 'quantity' | 'unit' | 'unitGross' | 'categoryTitle';
	type QuotationCreationPhase =
		| 'idle'
		| 'validating'
		| 'creating_draft'
		| 'research'
		| 'reasoning'
		| 'generating'
		| 'saving'
		| 'ready'
		| 'error';
	type PersistedQuotationFlow = {
		quotationId: string;
		lockVersion: number;
		generationIdempotencyKey: string;
	};

	const createKeyStorageKey = 'chmura:quotation-v2:create-idempotency-key';
	const flowStorageKey = 'chmura:quotation-v2:pending-flow';

	let mode = $state<Mode>('import');
	let title = $state('Nowa wycena');
	let fileName = $state('');
	let workbookData = $state<ArrayBuffer | null>(null);
	let selectedSheet = $state('');
	let importResult = $state<QuotationWorkbookImport | null>(null);
	let importedItems = $state<ImportedQuotationItem[]>([]);
	let manualItems = $state<ImportedQuotationItem[]>([createManualItem(0)]);
	let mapping = $state<QuotationColumnMapping>({});
	let mappingOpen = $state(false);
	let importLoading = $state(false);
	let generating = $state(false);
	let generateWithoutDescriptions = $state(false);
	let errorMessage = $state('');
	let flowPhase = $state<QuotationCreationPhase>('idle');
	let flowStatus = $state('');
	let createdQuotationId = $state('');
	let createdQuotationLockVersion = $state(0);
	let createIdempotencyKey = $state<string | null>(null);
	let generationIdempotencyKey = $state<string | null>(null);

	const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
	const mappingFields: Array<{ field: QuotationImportField; label: string; required?: boolean }> = [
		{ field: 'name', label: 'Nazwa', required: true },
		{ field: 'quantity', label: 'Ilość', required: true },
		{ field: 'unitGross', label: 'Cena brutto', required: true },
		{ field: 'unit', label: 'Jednostka' },
		{ field: 'category', label: 'Kategoria' },
		{ field: 'shortDescription', label: 'Krótki opis' }
	];

	let activeItems = $derived(mode === 'import' ? importedItems : manualItems);
	let totalGrossCents = $derived(
		activeItems.reduce((sum, item) => sum + (item.invalidFields?.length ? 0 : item.totalGrossCents), 0)
	);
	let validManualItems = $derived(
		manualItems.filter((item) => item.name.trim()).filter(isValidManualItem)
	);
	let hasInvalidManualRows = $derived(
		manualItems.some((item) => item.name.trim() && !isValidManualItem(item))
	);
	let hasInvalidImportedRows = $derived(importedItems.some((item) => !isValidManualItem(item)));
	let canGenerate = $derived(
		mode === 'import'
			? importedItems.length > 0 && !hasInvalidImportedRows
			: validManualItems.length > 0 && !hasInvalidManualRows
	);

	function setFlowPhase(phase: QuotationCreationPhase, message: string): void {
		flowPhase = phase;
		flowStatus = message;
	}

	function readStorage(key: string): string | null {
		if (typeof window === 'undefined') return null;
		try {
			return window.localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function writeStorage(key: string, value: string): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.setItem(key, value);
		} catch {
			// Private browsing or a disabled storage must not block generation.
		}
	}

	function removeStorage(key: string): void {
		if (typeof window === 'undefined') return;
		try {
			window.localStorage.removeItem(key);
		} catch {
			// Storage cleanup is best effort.
		}
	}

	function persistPendingFlow(): void {
		if (!createdQuotationId || !generationIdempotencyKey) return;
		writeStorage(
			flowStorageKey,
			JSON.stringify({
				quotationId: createdQuotationId,
				lockVersion: createdQuotationLockVersion,
				generationIdempotencyKey
			} satisfies PersistedQuotationFlow)
		);
	}

	function clearPendingFlow(): void {
		removeStorage(flowStorageKey);
		removeStorage(createKeyStorageKey);
	}

	onMount(() => {
		createIdempotencyKey = readStorage(createKeyStorageKey);
		const rawFlow = readStorage(flowStorageKey);
		if (!rawFlow) return;
		try {
			const parsed = JSON.parse(rawFlow) as Partial<PersistedQuotationFlow>;
			if (
				typeof parsed.quotationId !== 'string' ||
				!parsed.quotationId ||
				typeof parsed.generationIdempotencyKey !== 'string' ||
				!parsed.generationIdempotencyKey ||
				typeof parsed.lockVersion !== 'number' ||
				!Number.isInteger(parsed.lockVersion) ||
				parsed.lockVersion < 0
			) {
				removeStorage(flowStorageKey);
				return;
			}
			createdQuotationId = parsed.quotationId;
			createdQuotationLockVersion = parsed.lockVersion;
			generationIdempotencyKey = parsed.generationIdempotencyKey;
			setFlowPhase('error', 'Odzyskano niedokończony szkic. Możesz wznowić generowanie AI.');
			errorMessage = 'Połączenie zostało przerwane — szkic jest zachowany.';
		} catch {
			removeStorage(flowStorageKey);
		}
	});

	function createManualItem(index: number): ImportedQuotationItem {
		return {
			id: `manual-${crypto.randomUUID()}`,
			name: '',
			quantity: 0,
			unit: '',
			unitGrossCents: 0,
			totalGrossCents: 0,
			categoryTitle: 'Pozostałe',
			sortOrder: index,
			sourceRowNumber: index + 1
		};
	}

	function isValidManualItem(item: ImportedQuotationItem): boolean {
		return (
			(!item.invalidFields || item.invalidFields.length === 0) &&
			item.name.trim().length > 0 &&
			Number.isFinite(item.quantity) &&
			item.quantity > 0 &&
			Number.isFinite(item.unitGrossCents) &&
			item.unitGrossCents >= 0 &&
			item.unit.trim().length > 0
		);
	}

	function titleFromFileName(name: string): string {
		return name.replace(/\.xlsx$/i, '').replace(/[._-]+/g, ' ').trim() || 'Nowa wycena';
	}

	async function handleFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		importLoading = true;
		errorMessage = '';
		try {
			const result = await parseQuotationXlsxFile(file);
			workbookData = await file.arrayBuffer();
			fileName = file.name;
			title = titleFromFileName(file.name);
			applyImport(result);
		} catch (error) {
			importResult = null;
			importedItems = [];
			errorMessage =
				error instanceof QuotationXlsxImportError
					? error.message
					: 'Nie udało się zaimportować pliku XLSX.';
		} finally {
			importLoading = false;
		}
	}

	function applyImport(result: QuotationWorkbookImport) {
		importResult = result;
		importedItems = result.items;
		selectedSheet = result.selectedSheetName;
		mapping = { ...result.mapping };
	}

	function changeSheet(event: Event) {
		const sheetName = (event.currentTarget as HTMLSelectElement).value;
		if (!workbookData) return;
		try {
			applyImport(parseQuotationWorkbook(workbookData, { sheetName, mapping }));
			errorMessage = '';
		} catch (error) {
			errorMessage =
				error instanceof QuotationXlsxImportError
					? error.message
					: 'Nie udało się odczytać arkusza.';
		}
	}

	function changeMapping(field: QuotationImportField, value: string) {
		const nextMapping = { ...mapping, [field]: value === '' ? undefined : Number(value) };
		mapping = nextMapping;
		if (!workbookData) return;
		try {
			applyImport(parseQuotationWorkbook(workbookData, { sheetName: selectedSheet, mapping: nextMapping }));
			errorMessage = '';
		} catch (error) {
			errorMessage =
				error instanceof QuotationXlsxImportError
					? error.message
					: 'Nie udało się zastosować mapowania.';
		}
	}

	function updateItem(index: number, field: EditableField, rawValue: string) {
		const source = mode === 'import' ? importedItems : manualItems;
		const item = source[index];
		if (!item) return;
		const next = { ...item };
		if (field === 'name' || field === 'unit' || field === 'categoryTitle') next[field] = rawValue;
		if (field === 'quantity') next.quantity = Number(rawValue);
		if (field === 'unitGross') next.unitGrossCents = Math.round(Math.max(0, Number(rawValue) * 100));
		const invalidField = field === 'unitGross' ? 'unitGross' : field === 'quantity' ? 'quantity' : field === 'name' || field === 'unit' ? field : undefined;
		if (invalidField && next.invalidFields?.includes(invalidField)) {
			next.invalidFields = next.invalidFields.filter((entry) => entry !== invalidField);
		}
		next.totalGrossCents = Number.isFinite(next.quantity)
			? Math.round(next.quantity * next.unitGrossCents)
			: 0;
		const updated = [...source];
		updated[index] = next;
		if (mode === 'import') importedItems = updated;
		else manualItems = updated;
	}

	function addManualItem() {
		manualItems = [...manualItems, createManualItem(manualItems.length)];
	}

	function removeItem(index: number) {
		const source = mode === 'import' ? importedItems : manualItems;
		const next = source.filter((_, itemIndex) => itemIndex !== index).map((item, sortOrder) => ({
			...item,
			sortOrder,
			sourceRowNumber: sortOrder + 1
		}));
		if (mode === 'import') importedItems = next;
		else manualItems = next.length > 0 ? next : [createManualItem(0)];
	}

	function switchMode(nextMode: Mode) {
		mode = nextMode;
		errorMessage = '';
		if (nextMode === 'manual') title = 'Nowa wycena';
		else if (fileName) title = titleFromFileName(fileName);
		if (nextMode === 'manual' && manualItems.length === 0) manualItems = [createManualItem(0)];
	}

	async function createAndGenerate() {
		if (!canGenerate || generating) return;
		if (mode === 'manual' && manualItems.some((item) => !item.name.trim()) && validManualItems.length === 0) {
			errorMessage = 'Dodaj co najmniej jedną pozycję z nazwą.';
			return;
		}
		generating = true;
		errorMessage = '';
		setFlowPhase('validating', 'Sprawdzam dane wyceny…');
		try {
			setFlowPhase('creating_draft', 'Tworzę bezpieczny szkic…');
			createIdempotencyKey ??= readStorage(createKeyStorageKey) ?? crypto.randomUUID();
			writeStorage(createKeyStorageKey, createIdempotencyKey);
			const items = mode === 'import' ? importedItems : validManualItems;
			const draft = importedItemsToQuotationDraft(title.trim() || 'Nowa wycena', items);
			const createResponse = await fetch('/api/quotations', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...draft, idempotencyKey: createIdempotencyKey })
			});
			const createdPayload = await createResponse.json().catch(() => ({}));
			if (!createResponse.ok) {
				if (shouldRotateCreateIdempotencyKey(createdPayload)) {
					createIdempotencyKey = null;
					removeStorage(createKeyStorageKey);
				}
				throw new Error(readError(createdPayload, 'Nie udało się utworzyć szkicu.'));
			}
			const quotation = createdPayload.item ?? createdPayload.quotation ?? createdPayload;
			createdQuotationId = quotation.id;
			createdQuotationLockVersion = quotation.lockVersion ?? 0;
			createIdempotencyKey = null;
			removeStorage(createKeyStorageKey);

			if (generateWithoutDescriptions) {
				setFlowPhase('ready', 'Gotowe — szkic zawiera tabelę i sumę.');
				clearPendingFlow();
				await goto(`/wyceny/${encodeURIComponent(createdQuotationId)}`);
				return;
			}
			generationIdempotencyKey ??= crypto.randomUUID();
			persistPendingFlow();
			await generateExistingQuotation();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Nie udało się utworzyć wyceny.';
			if (shouldRotateIdempotencyError(error)) {
				generationIdempotencyKey = null;
				removeStorage(flowStorageKey);
			}
			setFlowPhase(
				'error',
				createdQuotationId ? 'Szkic zachowany — możesz spróbować ponownie.' : ''
			);
		} finally {
			generating = false;
		}
	}

	async function generateExistingQuotation() {
		if (!createdQuotationId) return;
		generationIdempotencyKey ??= crypto.randomUUID();
		persistPendingFlow();
		setFlowPhase('research', 'AI wykonuje research, reasoning i przygotowuje opisy…');
		const response = await fetch(`/api/quotations/${encodeURIComponent(createdQuotationId)}/ai/generate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
			body: JSON.stringify({
				selection: { mode: 'automatic' },
				expectedLockVersion: createdQuotationLockVersion,
				idempotencyKey: generationIdempotencyKey
			})
		});
		const payload = response.headers.get('content-type')?.includes('text/event-stream')
			? await consumeQuotationAiStream(response, handleGenerationEvent)
			: await response.json().catch(() => ({}));
		if (!response.ok) {
				if (shouldRotateGenerationIdempotencyKey(payload as Record<string, unknown>)) {
				generationIdempotencyKey = null;
				removeStorage(flowStorageKey);
			}
			throw new Error(readError(payload as Record<string, unknown>, 'Generowanie wyceny nie powiodło się.'));
		}
		generationIdempotencyKey = null;
		clearPendingFlow();
		setFlowPhase('ready', 'Gotowe — otwieram podgląd…');
		await goto(`/wyceny/${encodeURIComponent(createdQuotationId)}`);
	}

	function readError(payload: Record<string, unknown>, fallback: string): string {
		const nested = payload.error;
		if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
			const message = (nested as { message?: unknown }).message;
			if (typeof message === 'string' && message.trim()) return message;
		}
		return typeof payload.message === 'string' && payload.message.trim() ? payload.message : fallback;
	}

	function shouldRotateCreateIdempotencyKey(payload: Record<string, unknown>): boolean {
		const nested = payload.error;
		const code =
			nested && typeof nested === 'object' && !Array.isArray(nested)
				? (nested as { code?: unknown }).code
				: payload.code;
		return code === 'conflict' || code === 'quotation_idempotency_conflict';
	}

	function shouldRotateGenerationIdempotencyKey(payload: Record<string, unknown>): boolean {
		const nested = payload.error;
		const code =
			nested && typeof nested === 'object' && !Array.isArray(nested)
				? (nested as { code?: unknown }).code
				: payload.code;
		// Provider, validation, and in-flight-operation errors all belong to the
		// same generation attempt. Keep its key stable so a retry can replay it.
		return code === 'quotation_idempotency_conflict';
	}

	function shouldRotateIdempotencyError(error: unknown): boolean {
		if (!error || typeof error !== 'object') return false;
		return (error as { code?: unknown }).code === 'quotation_idempotency_conflict';
	}

	function handleGenerationEvent(event: QuotationAiStreamEvent): void {
		if (event.type === 'status') {
			const phase: Record<Extract<QuotationAiStreamEvent, { type: 'status' }>['stage'], QuotationCreationPhase> = {
				preparing: 'validating',
				research: 'research',
				generating: 'generating',
				saving: 'saving'
			};
			setFlowPhase(phase[event.stage], event.message);
		} else if (event.type === 'reasoning.delta') {
			setFlowPhase('reasoning', 'AI porządkuje wnioski i dobiera narrację…');
		} else if (event.type === 'web_search.started') {
			setFlowPhase('research', `Sprawdzam aktualne informacje: ${event.itemName}`);
		}
	}
</script>

<svelte:head>
	<title>Nowa wycena — Chmura Blokserwis</title>
	<meta name="description" content="Utwórz wycenę z pliku XLSX albo ręcznie." />
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 pb-12" data-flow-phase={flowPhase}>
	<header class="space-y-2">
		<a href="/wyceny" class="text-sm font-medium text-primary hover:underline">Wróć do wycen</a>
		<h1 class="text-2xl font-bold tracking-tight text-text-main">Nowa wycena</h1>
		<p class="max-w-2xl text-sm leading-6 text-text-muted">
			Zaimportuj pozycje z XLSX lub wpisz je ręcznie. Jeden przycisk uruchomi domyślny proces AI i od razu otworzy podgląd.
		</p>
	</header>

	<section class="space-y-5 rounded-md border border-border-line bg-bg-panel p-5 sm:p-6">
		<div class="flex flex-wrap gap-2 border-b border-border-line pb-4">
			<button type="button" class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium {mode === 'import' ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-app'}" onclick={() => switchMode('import')}>
				<FileXls class="h-4 w-4" weight="bold" /> Import XLSX
			</button>
			<button type="button" class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium {mode === 'manual' ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-app'}" onclick={() => switchMode('manual')}>
				<Keyboard class="h-4 w-4" weight="bold" /> Wpisz ręcznie
			</button>
		</div>

		{#if mode === 'import'}
			<label class="grid gap-2">
				<span class="text-sm font-semibold text-text-main">Plik XLSX</span>
				<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onchange={handleFileChange} class="block min-h-11 w-full rounded-md border border-border-line bg-bg-app text-sm text-text-muted file:mr-4 file:h-11 file:border-0 file:border-r file:border-border-line file:bg-bg-panel file:px-4 file:text-sm file:font-medium file:text-text-main" />
				<span class="text-xs text-text-muted">Maksymalnie 5 MB i 500 pozycji.</span>
			</label>
			{#if importLoading}<div class="h-20 animate-pulse rounded-md bg-bg-app"></div>{/if}
			{#if importResult}
				<div class="grid gap-3 rounded-md border border-border-line bg-bg-app p-4 sm:grid-cols-3">
					<div><p class="text-xs text-text-muted">Plik</p><p class="mt-1 truncate text-sm font-medium text-text-main">{fileName}</p></div>
					<div><p class="text-xs text-text-muted">Pozycje</p><p class="mt-1 text-sm font-medium text-text-main">{importedItems.length}</p></div>
					<div><p class="text-xs text-text-muted">Suma</p><p class="mt-1 text-sm font-medium text-text-main">{money.format(totalGrossCents / 100)}</p></div>
				</div>
				{#if importResult.issues.length > 0}
					<div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p class="font-medium">Ostrzeżenia: {importResult.issues.length}</p><p class="mt-1 text-xs">Niektóre wiersze lub pola wymagały korekty. Szczegóły są dostępne poniżej.</p></div>
				{/if}
				{#if hasInvalidImportedRows}<p class="text-sm text-red-700 dark:text-red-300">Uzupełnij nazwę, ilość, jednostkę i cenę w oznaczonych wierszach, aby wygenerować wycenę.</p>{/if}
				<details bind:open={mappingOpen} class="rounded-md border border-border-line bg-bg-app p-4">
					<summary class="cursor-pointer text-sm font-semibold text-text-main">Sprawdź dane importu</summary>
					<div class="mt-4 space-y-4">
						{#if importResult.sheets.length > 1}
							<label class="grid max-w-sm gap-1 text-xs text-text-muted">Arkusz<select value={selectedSheet} onchange={changeSheet} class="h-9 rounded-md border border-border-line bg-bg-panel px-2 text-sm text-text-main">{#each importResult.sheets as sheet (sheet.name)}<option value={sheet.name} disabled={!sheet.canImport}>{sheet.name}</option>{/each}</select></label>
						{/if}
						<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each mappingFields as config (config.field)}<label class="grid gap-1 text-xs text-text-muted">{config.label}{config.required ? ' *' : ''}<select value={mapping[config.field] ?? ''} onchange={(event) => changeMapping(config.field, event.currentTarget.value)} class="h-9 rounded-md border border-border-line bg-bg-panel px-2 text-sm text-text-main"><option value="">Nie mapuj</option>{#each importResult.headers as header, index (`${config.field}-${index}`)}<option value={index}>{header || `Kolumna ${index + 1}`}</option>{/each}</select></label>{/each}
						</div>
						<div class="overflow-x-auto rounded-md border border-border-line">
							<table class="w-full min-w-[680px] border-collapse text-left text-sm"><thead class="bg-bg-panel text-xs text-text-muted"><tr><th class="px-3 py-2">Nazwa</th><th class="px-3 py-2">Ilość</th><th class="px-3 py-2">Jednostka</th><th class="px-3 py-2">Kategoria</th><th class="px-3 py-2 text-right">Cena brutto</th><th class="w-10"></th></tr></thead><tbody>
								{#each importedItems as item, index (item.id)}<tr class="border-t border-border-line {item.invalidFields?.length ? 'bg-red-50/60 dark:bg-red-950/20' : ''}"><td class="px-3 py-2"><input aria-label="Nazwa dla {item.name || `wiersza ${index + 1}`}" value={item.name} oninput={(event) => updateItem(index, 'name', event.currentTarget.value)} class="h-9 w-full min-w-44 rounded-md border border-border-line bg-bg-panel px-2 text-text-main" /></td><td class="px-3 py-2"><input type="number" min="0.001" step="0.001" value={item.quantity || ''} oninput={(event) => updateItem(index, 'quantity', event.currentTarget.value)} class="h-9 w-20 rounded-md border border-border-line bg-bg-panel px-2 text-text-main" /></td><td class="px-3 py-2"><input aria-label="Jednostka dla {item.name}" value={item.unit} oninput={(event) => updateItem(index, 'unit', event.currentTarget.value)} class="h-9 w-20 rounded-md border border-border-line bg-bg-panel px-2 text-text-main" /></td><td class="px-3 py-2"><input aria-label="Kategoria dla {item.name}" value={item.categoryTitle ?? ''} oninput={(event) => updateItem(index, 'categoryTitle', event.currentTarget.value)} class="h-9 w-36 rounded-md border border-border-line bg-bg-panel px-2 text-text-main" /></td><td class="px-3 py-2 text-right"><input type="number" min="0" step="0.01" value={item.invalidFields?.includes('unitGross') ? '' : (item.unitGrossCents / 100).toFixed(2)} oninput={(event) => updateItem(index, 'unitGross', event.currentTarget.value)} class="h-9 w-28 rounded-md border border-border-line bg-bg-panel px-2 text-right text-text-main" /></td><td class="px-2 py-2"><button type="button" onclick={() => removeItem(index)} aria-label="Usuń pozycję {item.name}" class="rounded p-2 text-text-muted hover:bg-red-50 hover:text-red-600"><X class="h-4 w-4" /></button></td></tr>{/each}
							</tbody></table>
						</div>
					</div>
				</details>
			{:else if !importLoading}<div class="rounded-md border border-dashed border-border-line p-8 text-center text-sm text-text-muted">Wybierz plik, aby zobaczyć podsumowanie.</div>{/if}
		{:else}
			<div class="space-y-3"><div><h2 class="text-sm font-semibold text-text-main">Pozycje wyceny</h2><p class="mt-1 text-xs text-text-muted">Uzupełnij nazwę, ilość, jednostkę i cenę brutto. Pusty wiersz możesz zostawić na później.</p></div>
				<div class="overflow-x-auto rounded-md border border-border-line"><table class="w-full min-w-[520px] border-collapse text-left text-sm"><thead class="bg-bg-app text-xs text-text-muted"><tr><th class="px-3 py-2">Nazwa</th><th class="px-3 py-2">Ilość</th><th class="px-3 py-2">Jednostka</th><th class="px-3 py-2 text-right">Cena brutto</th><th class="w-12"></th></tr></thead><tbody>
					{#each manualItems as item, index (item.id)}<tr class="border-t border-border-line"><td class="px-3 py-2"><input aria-label="Nazwa pozycji {index + 1}" value={item.name} oninput={(event) => updateItem(index, 'name', event.currentTarget.value)} placeholder="np. Montaż kamery" class="h-10 w-full min-w-44 rounded-md border border-border-line bg-bg-app px-2 text-text-main" /></td><td class="px-3 py-2"><input aria-label="Ilość pozycji {index + 1}" type="number" min="0" step="0.001" value={item.quantity || ''} oninput={(event) => updateItem(index, 'quantity', event.currentTarget.value)} class="h-10 w-24 rounded-md border border-border-line bg-bg-app px-2 text-text-main" /></td><td class="px-3 py-2"><input aria-label="Jednostka pozycji {index + 1}" value={item.unit} oninput={(event) => updateItem(index, 'unit', event.currentTarget.value)} class="h-10 w-24 rounded-md border border-border-line bg-bg-app px-2 text-text-main" /></td><td class="px-3 py-2"><input aria-label="Cena brutto pozycji {index + 1}" type="number" min="0" step="0.01" value={item.name || item.quantity || item.unit ? (item.unitGrossCents / 100).toFixed(2) : ''} oninput={(event) => updateItem(index, 'unitGross', event.currentTarget.value)} class="h-10 w-28 rounded-md border border-border-line bg-bg-app px-2 text-right text-text-main" /></td><td class="px-2 py-2"><button type="button" onclick={() => removeItem(index)} aria-label="Usuń pozycję {index + 1}" class="rounded p-2 text-text-muted hover:bg-red-50 hover:text-red-600"><X class="h-4 w-4" /></button></td></tr>{/each}
				</tbody></table></div>{#if hasInvalidManualRows}<p class="text-sm text-red-700 dark:text-red-300">Każda rozpoczęta pozycja wymaga dodatniej ilości, jednostki i ceny.</p>{/if}<Button variant="secondary" size="sm" onclick={addManualItem}><Plus class="mr-1.5 h-4 w-4" /> Dodaj pozycję</Button></div>
		{/if}

		{#if errorMessage}<div class="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert"><WarningCircle class="mt-0.5 h-5 w-5 shrink-0" /><p>{errorMessage}</p></div>{/if}
		{#if flowStatus}<p class="text-sm text-text-muted" aria-live="polite">{flowStatus}</p>{/if}

		<details class="rounded-md border border-border-line bg-bg-app p-4"><summary class="cursor-pointer text-sm font-medium text-text-main">Opcje zaawansowane</summary><div class="mt-3 grid gap-2"><label class="grid gap-1 text-xs text-text-muted">Tytuł początkowy<input bind:value={title} maxlength="160" class="h-10 rounded-md border border-border-line bg-bg-panel px-3 text-sm text-text-main" /></label><p class="text-xs text-text-muted">Tytuł nie blokuje generowania. Po wygenerowaniu możesz go zmienić w podglądzie.</p></div></details>

		<div class="flex flex-col gap-4 border-t border-border-line pt-5 sm:flex-row sm:items-center sm:justify-between"><label class="flex items-start gap-2 text-sm text-text-main"><input type="checkbox" bind:checked={generateWithoutDescriptions} class="mt-0.5 file-selection-checkbox" /><span><span class="block font-medium">Generuj bez opisów</span><span class="mt-0.5 block text-xs text-text-muted">Utworzy tabelę i podgląd bez researchu oraz kosztownych wywołań AI.</span></span></label><Button loading={generating} disabled={!canGenerate || generating} onclick={createAndGenerate} class="sm:min-w-52">Wygeneruj wycenę</Button></div>

		{#if createdQuotationId && errorMessage}<div class="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><span class="mr-auto">Szkic jest zachowany. Możesz ponowić tylko etap AI.</span><Button variant="secondary" size="sm" loading={generating} onclick={async () => { generating = true; errorMessage = ''; try { await generateExistingQuotation(); } catch (error) { if (shouldRotateIdempotencyError(error)) { generationIdempotencyKey = null; removeStorage(flowStorageKey); } errorMessage = error instanceof Error ? error.message : 'Ponowienie AI nie powiodło się.'; } finally { generating = false; } }}>Spróbuj ponownie</Button><Button variant="ghost" size="sm" onclick={() => goto(`/wyceny/${encodeURIComponent(createdQuotationId)}`)}>Otwórz szkic</Button></div>{/if}
	</section>
</div>
