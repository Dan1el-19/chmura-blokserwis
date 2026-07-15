import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(new URL('./QuotationEditor.svelte', import.meta.url), 'utf8');

describe('quotation editor critical UX contracts', () => {
	it('uses the serialized autosave state machine and the shared price estimator', () => {
		expect(editor).toContain("import { QuotationAutosave } from '$lib/quotations/autosave.svelte'");
		expect(editor).toContain("import { estimateQuotationAiCost } from '$lib/quotations/cost'");
		expect(editor).toContain('autosave.schedule(cloneJson($state.snapshot(document)))');
		expect(editor).not.toContain('structuredClone(');
		expect(editor).not.toContain('prompt * 0.004');
	});

	it('keeps approved quotations editable while archived quotations stay locked', () => {
		expect(editor).toContain("let editable = $derived(quotation.status !== 'archived')");
		expect(editor).not.toContain("quotation.status !== 'draft'");
		expect(editor).toContain('Zatwierdź zmiany ponownie');
	});
});
