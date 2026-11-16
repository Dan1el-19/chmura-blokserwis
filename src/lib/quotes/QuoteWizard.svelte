<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { getQuoteClient } from '#lib/api.js';
	import { QuotePriceMode } from '#lib/gen/unisource/v2/quotes_pb.js';
	import QuoteEditor from './QuoteEditor.svelte';
	import { button, field, panel, quoteError } from './ui.js';
	import { readWizardLocation, wizardHref, wizardStages, type WizardEditorState, type WizardStage } from './wizard-state.js';

	let { id }: { id: string } = $props();
	let initialFile = $state<File>();
	let initialFileQuoteId = $state('');
	let creating = $state(false);
	let error = $state('');
	let createKey = '';
	let previousId: string | undefined;
	$effect.pre(() => {
		const nextId = id;
		if (nextId === 'nowa' && previousId !== 'nowa') {
			createKey = '';
			initialFile = undefined;
			initialFileQuoteId = '';
			error = '';
		}
		previousId = nextId;
	});
	let editor = $state<WizardEditorState>({ dirty: false, saving: false, busy: false, pdfCurrent: false });
	const labels: Record<WizardStage, string> = {
		import: 'Import danych', review: 'Sprawdź dane', agent: 'Asystent AI', preview: 'Podgląd PDF', summary: 'Podsumowanie'
	};
	const descriptions: Record<WizardStage, string> = {
		import: 'Wybierz arkusz z pozycjami i cenami, aby rozpocząć wycenę.',
		review: 'Sprawdź dane klienta i pozycje. Możesz je poprawić przed przygotowaniem dokumentu.',
		agent: 'Przygotuj nazwy, opisy i zakres z pomocą AI. Każda propozycja wymaga Twojej akceptacji.',
		preview: 'Obejrzyj cały dokument. Zatwierdzenie dotyczy aktualnej wersji PDF.',
		summary: 'Wycena została zatwierdzona. Pobierz gotowy dokument lub przygotuj kolejną rewizję.'
	};
	const currentUrl = $derived(page.shallow?.url ?? page.url);
	const legacy = $derived(editor.quote?.id === id && editor.quote.draft?.documentSchemaVersion !== 2);
	const location = $derived(id === 'nowa'
		? { stage: 'import' as const, editing: false }
		: readWizardLocation(currentUrl, savedStage(editor)));
	const step = $derived(wizardStages.indexOf(location.stage));
	const wizardMode = $derived({ ...location, resume: !wizardStages.includes(currentUrl.searchParams.get('step') as WizardStage), initialFile: initialFileQuoteId === id ? initialFile : undefined, onstagechange: changeStage, onstatechange: updateEditor });

	function savedStage(state: WizardEditorState): WizardStage {
		if (state.quote?.id !== id) return 'review';
		const saved = state.quote.workflow?.stage;
		if (wizardStages.includes(saved as WizardStage)) return saved as WizardStage;
		return state.quote?.currentRevision ? 'summary' : 'review';
	}

	function updateEditor(state: WizardEditorState) { editor = state; }

	async function changeStage(stage: WizardStage, editing = false) {
		const href = wizardHref(currentUrl, stage, editing);
		if (`${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` !== href) {
			// The href retains page.url.pathname, which already contains SvelteKit's base path.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(href, { state: page.state, shallow: true, reset: false });
		}
	}

	async function start(file?: File) {
		if (creating) return;
		if (file && !file.name.toLowerCase().endsWith('.xlsx')) { error = 'Wybierz plik w formacie XLSX.'; return; }
		creating = true;
		error = '';
		try {
			createKey ||= crypto.randomUUID();
			const result = await getQuoteClient().createQuote({
				idempotencyKey: createKey,
				draft: { title: 'Nowa wycena', priceMode: QuotePriceMode.GROSS, documentSchemaVersion: 2 }
			});
			if (!result.quote) throw new Error('Nie otrzymano identyfikatora szkicu.');
			initialFile = file;
			initialFileQuoteId = result.quote.id;
			// The pathname is resolved before adding the wizard query.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			await goto(`${resolve('/wyceny/[id]', { id: result.quote.id })}?step=${file ? 'import' : 'review&edit=1'}`, { replace: true, reset: false });
		} catch (reason) {
			error = quoteError(reason);
		} finally {
			creating = false;
		}
	}
</script>

<section class="quote-wizard mx-auto max-w-7xl space-y-5" aria-label="Kreator wyceny">
	{#if !legacy}
	<a class="inline-flex min-h-11 items-center text-sm font-medium text-text-muted hover:text-primary" href={resolve('/wyceny')}>← Wyceny</a>
	<nav aria-label="Etapy wyceny">
		<ol class="wizard-steps">
			{#each wizardStages as stage, index (stage)}
				<li aria-current={location.stage === stage ? 'step' : undefined} class:current={location.stage === stage} class:completed={index < step}>
					<span class="step-number" aria-hidden="true">{index + 1}</span>
					<span class="step-label">{labels[stage]}</span>
				</li>
			{/each}
		</ol>
	</nav>
	<header class="space-y-2">
		<p class="text-sm text-text-muted">Krok {step + 1} z {wizardStages.length}{editor.quote?.id === id && editor.quote.number ? ` · ${editor.quote.number}` : ''}</p>
		<h1 class="text-2xl font-semibold">{location.editing ? 'Edytuj wycenę' : labels[location.stage]}</h1>
		<p class="max-w-3xl text-sm text-text-muted">{location.editing ? 'Popraw dane i zapisz zmiany, aby wrócić do pełnego podglądu PDF.' : descriptions[location.stage]}</p>
	</header>
	{/if}
	{#if error}<p role="alert" class="rounded-md border border-red-400 p-3">{error}</p>{/if}
	{#if id === 'nowa'}
		<div class="{panel} import-choice">
			<div class="space-y-2">
				<h2 class="font-semibold">Import z arkusza XLSX</h2>
				<p class="text-sm text-text-muted">Po wyborze pliku utworzymy szkic. Przed użyciem danych sprawdzisz rozpoznane pozycje i ceny.</p>
			</div>
			<label class="block space-y-2 font-medium">Plik XLSX
				<input class={field} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={creating} onchange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void start(file); }} />
			</label>
			{#if creating}<p role="status">Tworzenie szkicu…</p>{/if}
			<details class="border-t border-border-line pt-4">
				<summary class="min-h-11 cursor-pointer py-2 text-sm font-medium">Opcje zaawansowane</summary>
				<div class="mt-2 space-y-3">
					<p class="text-sm text-text-muted">Możesz rozpocząć od pustego formularza i samodzielnie dodać pozycje.</p>
					<button type="button" class={button} disabled={creating} onclick={() => start()}>Wprowadź dane ręcznie</button>
				</div>
			</details>
		</div>
	{:else}
		<!-- Keep the editor mounted across stages: operations and unsaved edits belong to this instance. -->
		{#key id}<QuoteEditor {id} wizardMode={legacy ? undefined : wizardMode} />{/key}
	{/if}
</section>

<style>
	.quote-wizard { min-width: 0; container-type: inline-size; overflow-wrap: anywhere; }
	.wizard-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: .5rem; }
	.wizard-steps li { display: flex; min-width: 0; align-items: center; gap: .5rem; border-bottom: 2px solid var(--color-border-line); padding: .5rem 0 .75rem; color: var(--color-text-muted); font-size: .8125rem; }
	.wizard-steps .current { border-color: var(--color-primary); color: var(--color-text-main); font-weight: 600; }
	.step-number { display: grid; width: 1.75rem; height: 1.75rem; flex-shrink: 0; place-items: center; border: 1px solid var(--color-border-line); border-radius: 50%; }
	.current .step-number { border-color: var(--color-primary); background: var(--color-primary); color: white; }
	.completed .step-number { border-color: var(--color-primary); color: var(--color-primary); }
	.import-choice { max-width: 48rem; }
	.quote-wizard :global(button), .quote-wizard :global(input) { min-height: 44px; }
	.quote-wizard :global(input[type='file']) { max-width: 100%; min-width: 0; font-size: .875rem; }
	.quote-wizard :global(:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 3px; }
	@container (max-width: 560px) {
		.wizard-steps { gap: .375rem; }
		.wizard-steps li { justify-content: center; }
		.step-label { display: none; }
	}
</style>
