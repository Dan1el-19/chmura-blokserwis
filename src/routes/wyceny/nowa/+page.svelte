<script lang="ts">
	import { goto } from '$app/navigation';
	import { FileXls, Keyboard, WarningCircle, X } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		createManualQuotationDraft,
		importedItemsToQuotationDraft
	} from '$lib/quotations/document';
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

	type Mode = 'choice' | 'import' | 'manual';

	let mode = $state<Mode>('choice');
	let title = $state('Nowa wycena');
	let importResult = $state<QuotationWorkbookImport | null>(null);
	let importedItems = $state<ImportedQuotationItem[]>([]);
	let workbookData = $state<ArrayBuffer | null>(null);
	let selectedSheet = $state('');
	let fileName = $state('');
	let importError = $state('');
	let saveError = $state('');
	let importLoading = $state(false);
	let saving = $state(false);
	let mapping = $state<QuotationColumnMapping>({});
	const mappingFields: Array<{ field: QuotationImportField; label: string; required?: boolean }> = [
		{ field: 'name', label: 'Nazwa', required: true },
		{ field: 'quantity', label: 'Ilość', required: true },
		{ field: 'unitGross', label: 'Cena brutto', required: true },
		{ field: 'unit', label: 'Jednostka' },
		{ field: 'category', label: 'Kategoria' },
		{ field: 'shortDescription', label: 'Krótki opis' }
	];

	const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
	let totalGrossCents = $derived(
		importedItems.reduce((sum, item) => sum + item.totalGrossCents, 0)
	);

	async function handleFileChange(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		importLoading = true;
		importError = '';
		try {
			const result = await parseQuotationXlsxFile(file);
			workbookData = await file.arrayBuffer();
			fileName = file.name;
			applyImport(result);
		} catch (error) {
			importResult = null;
			importedItems = [];
			importError =
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
			applyImport(parseQuotationWorkbook(workbookData, { sheetName }));
			importError = '';
		} catch (error) {
			importError =
				error instanceof QuotationXlsxImportError
					? error.message
					: 'Nie udało się odczytać arkusza.';
		}
	}

	function changeMapping(field: QuotationImportField, value: string) {
		mapping = { ...mapping, [field]: value === '' ? undefined : Number(value) };
		if (!workbookData) return;
		try {
			applyImport(parseQuotationWorkbook(workbookData, { sheetName: selectedSheet, mapping }));
			importError = '';
		} catch (error) {
			importError =
				error instanceof QuotationXlsxImportError
					? error.message
					: 'Nie udało się zastosować mapowania.';
		}
	}

	function updateItem(index: number, field: 'unit' | 'categoryTitle', value: string) {
		importedItems[index] = { ...importedItems[index], [field]: value };
	}

	function removeItem(index: number) {
		importedItems = importedItems
			.filter((_, itemIndex) => itemIndex !== index)
			.map((item, sortOrder) => ({ ...item, sortOrder }));
	}

	async function saveDraft() {
		saving = true;
		saveError = '';
		try {
			const draft =
				mode === 'import'
					? importedItemsToQuotationDraft(title, importedItems)
					: createManualQuotationDraft({ title });
			const response = await fetch('/api/quotations', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...draft, idempotencyKey: crypto.randomUUID() })
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok)
				throw new Error(
					payload.message ??
						payload.error?.message ??
						(typeof payload.error === 'string' ? payload.error : 'Nie udało się utworzyć wyceny.')
				);
			const quotation = payload.item ?? payload.quotation ?? payload;
			await goto(quotation.id ? `/wyceny/${quotation.id}` : '/wyceny');
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Nie udało się utworzyć wyceny.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Nowa wycena — Chmura Blokserwis</title>
	<meta name="description" content="Nowa wycena firmowa Blokserwis." />
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6">
	<header>
		<a href="/wyceny" class="text-sm font-medium text-primary hover:underline">Wróć do wycen</a>
		<h1 class="mt-3 text-2xl font-bold tracking-tight text-text-main">Nowa wycena</h1>
		<p class="mt-1 text-sm text-text-muted">Wybierz sposób rozpoczęcia szkicu.</p>
	</header>

	{#if mode === 'choice'}
		<div class="grid gap-4 md:grid-cols-2">
			<button
				type="button"
				onclick={() => (mode = 'import')}
				class="flex min-h-40 items-start gap-4 rounded-md border border-border-line bg-bg-panel p-6 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:translate-y-px"
			>
				<span
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary dark:bg-blue-950/40"
				>
					<FileXls class="h-6 w-6" weight="bold" />
				</span>
				<span>
					<span class="block font-semibold text-text-main">Importuj plik XLSX</span>
					<span class="mt-1 block text-sm leading-6 text-text-muted">
						Wykryj arkusz, kolumny i pozycje. Przed zapisem sprawdzisz jednostki i kategorie.
					</span>
				</span>
			</button>
			<button
				type="button"
				onclick={() => (mode = 'manual')}
				class="flex min-h-40 items-start gap-4 rounded-md border border-border-line bg-bg-panel p-6 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none active:translate-y-px"
			>
				<span
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gray-100 text-text-main dark:bg-zinc-800"
				>
					<Keyboard class="h-6 w-6" weight="bold" />
				</span>
				<span>
					<span class="block font-semibold text-text-main">Wpisz pozycje ręcznie</span>
					<span class="mt-1 block text-sm leading-6 text-text-muted">
						Utwórz szkic z pierwszą kategorią i pozycją, a następnie uzupełnij szczegóły.
					</span>
				</span>
			</button>
		</div>
	{:else}
		<section class="space-y-5 rounded-md border border-border-line bg-bg-panel p-5 sm:p-6">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h2 class="font-semibold text-text-main">
						{mode === 'import' ? 'Import pozycji' : 'Pusty szkic'}
					</h2>
					<p class="mt-1 text-sm text-text-muted">
						{mode === 'import'
							? 'Plik jest przetwarzany wyłącznie w tej przeglądarce.'
							: 'Nadaj szkicowi nazwę i przejdź do edytora.'}
					</p>
				</div>
				<Button variant="ghost" size="sm" onclick={() => (mode = 'choice')}>Zmień sposób</Button>
			</div>

			<label class="grid gap-2">
				<span class="text-sm font-medium text-text-main">Nazwa wyceny</span>
				<input
					bind:value={title}
					maxlength="160"
					class="h-11 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main outline-none focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</label>

			{#if mode === 'import'}
				<label class="grid gap-2">
					<span class="text-sm font-medium text-text-main">Plik XLSX</span>
					<input
						type="file"
						accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						onchange={handleFileChange}
						class="block min-h-11 w-full rounded-md border border-border-line bg-bg-app text-sm text-text-muted file:mr-4 file:h-11 file:border-0 file:border-r file:border-border-line file:bg-bg-panel file:px-4 file:text-sm file:font-medium file:text-text-main hover:file:bg-gray-50 dark:hover:file:bg-zinc-800"
					/>
					<span class="text-xs text-text-muted">Maksymalnie 5 MB i 500 wykrytych wierszy.</span>
				</label>

				{#if importLoading}
					<div class="h-20 animate-pulse rounded-md bg-gray-100 dark:bg-zinc-800"></div>
				{/if}

				{#if importError}
					<div
						class="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
					>
						<WarningCircle class="mt-0.5 h-5 w-5 shrink-0" />
						<p>{importError}</p>
					</div>
				{/if}

				{#if importResult}
					<div
						class="flex flex-col gap-4 border-t border-border-line pt-5 sm:flex-row sm:items-end sm:justify-between"
					>
						<div>
							<p class="text-sm font-medium text-text-main">{fileName}</p>
							<p class="mt-1 text-xs text-text-muted">
								Wykryto {importedItems.length} pozycji, suma {money.format(totalGrossCents / 100)}
							</p>
						</div>
						{#if importResult.sheets.length > 1}
							<label class="grid gap-1 text-sm text-text-main">
								<span class="text-xs text-text-muted">Arkusz</span>
								<select
									value={selectedSheet}
									onchange={changeSheet}
									class="h-10 rounded-md border border-border-line bg-bg-app px-3"
								>
									{#each importResult.sheets as sheet (sheet.name)}
										<option value={sheet.name} disabled={!sheet.canImport}>{sheet.name}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>

					{#if importResult.issues.length > 0}
						<div
							class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
						>
							<p class="font-medium">Pominięto {importResult.issues.length} niepoprawnych pól.</p>
							<p class="mt-1 text-xs">
								Sprawdź wiersze: {importResult.issues.map((issue) => issue.rowNumber).join(', ')}.
							</p>
						</div>
					{/if}

					<div class="rounded-md border border-border-line bg-bg-app p-4">
						<h3 class="text-sm font-semibold text-text-main">Mapowanie kolumn</h3>
						<p class="mt-1 text-xs text-text-muted">
							Skoryguj wykryte kolumny, jeśli podgląd pozycji nie jest prawidłowy.
						</p>
						<div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each mappingFields as config (config.field)}
								<label class="grid gap-1 text-xs text-text-muted"
									>{config.label}{config.required ? ' *' : ''}
									<select
										value={mapping[config.field] ?? ''}
										onchange={(event) => changeMapping(config.field, event.currentTarget.value)}
										class="h-9 rounded-md border border-border-line bg-bg-panel px-2 text-sm text-text-main"
									>
										<option value="">Nie mapuj</option>
										{#each importResult.headers as header, index (`${config.field}-${index}`)}<option
												value={index}>{header || `Kolumna ${index + 1}`}</option
											>{/each}
									</select>
								</label>
							{/each}
						</div>
					</div>

					<div class="overflow-x-auto rounded-md border border-border-line">
						<table class="w-full min-w-220 border-collapse text-left text-sm">
							<thead class="bg-bg-app text-xs text-text-muted">
								<tr>
									<th class="px-3 py-2.5 font-medium">Pozycja</th>
									<th class="px-3 py-2.5 font-medium">Ilość</th>
									<th class="px-3 py-2.5 font-medium">Jednostka</th>
									<th class="px-3 py-2.5 font-medium">Kategoria</th>
									<th class="px-3 py-2.5 text-right font-medium">Cena brutto</th>
									<th class="px-3 py-2.5 text-right font-medium">Wartość</th>
									<th class="w-12"><span class="sr-only">Akcje</span></th>
								</tr>
							</thead>
							<tbody>
								{#each importedItems as item, index (item.id)}
									<tr class="border-t border-border-line">
										<td class="max-w-80 px-3 py-2.5 font-medium text-text-main">{item.name}</td>
										<td class="px-3 py-2.5 font-mono text-text-main">{item.quantity}</td>
										<td class="px-3 py-2">
											<input
												aria-label="Jednostka dla {item.name}"
												value={item.unit}
												oninput={(event) => updateItem(index, 'unit', event.currentTarget.value)}
												class="h-9 w-20 rounded-md border border-border-line bg-bg-app px-2 text-text-main"
											/>
										</td>
										<td class="px-3 py-2">
											<input
												aria-label="Kategoria dla {item.name}"
												value={item.categoryTitle ?? ''}
												oninput={(event) =>
													updateItem(index, 'categoryTitle', event.currentTarget.value)}
												class="h-9 w-40 rounded-md border border-border-line bg-bg-app px-2 text-text-main"
											/>
										</td>
										<td class="px-3 py-2.5 text-right font-mono text-text-main">
											{money.format(item.unitGrossCents / 100)}
										</td>
										<td class="px-3 py-2.5 text-right font-mono text-text-main">
											{money.format(item.totalGrossCents / 100)}
										</td>
										<td class="px-2 py-2">
											<button
												type="button"
												onclick={() => removeItem(index)}
												class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none dark:hover:bg-red-950/30"
												aria-label="Usuń pozycję {item.name}"
											>
												<X class="h-4 w-4" />
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/if}

			{#if saveError}
				<div
					class="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
				>
					<WarningCircle class="mt-0.5 h-5 w-5 shrink-0" />
					<p>{saveError}</p>
				</div>
			{/if}

			<div
				class="flex flex-col-reverse gap-2 border-t border-border-line pt-5 sm:flex-row sm:justify-end"
			>
				<Button variant="secondary" onclick={() => (mode = 'choice')}>Anuluj</Button>
				<Button
					loading={saving}
					disabled={!title.trim() || (mode === 'import' && importedItems.length === 0)}
					onclick={saveDraft}
				>
					Utwórz wycenę
				</Button>
			</div>
		</section>
	{/if}
</div>
