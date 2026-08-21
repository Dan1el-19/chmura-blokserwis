import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(new URL('./QuotationEditor.svelte', import.meta.url), 'utf8');

describe('quotation editor critical UX contracts', () => {
	it('uses the serialized autosave state machine', () => {
		expect(editor).toContain("import { QuotationAutosave } from '$lib/quotations/autosave.svelte'");
		expect(editor).toContain('autosave.schedule(cloneJson($state.snapshot(document)))');
		expect(editor).not.toContain('structuredClone(');
	});

	it('keeps approved quotations editable while archived quotations stay locked', () => {
		expect(editor).toContain("let editable = $derived(quotation.status !== 'archived')");
		expect(editor).not.toContain("quotation.status !== 'draft'");
		expect(editor).toContain('Zatwierdź zmiany ponownie');
	});

	it('pins generation and revisions to GPT 5.6 Luna without exposing a model selector', () => {
		expect(editor).toContain("import { QUOTATION_AI_MODEL_ID } from '$lib/quotations/models'");
		expect(editor).toContain('modelId: QUOTATION_AI_MODEL_ID');
		expect(editor).not.toContain('QuotationModelSelector');
		expect(editor).not.toContain('MODEL_STORAGE_KEY');
	});

	it('keeps reasoning disabled for the fixed model', () => {
		expect(editor.match(/reasoningEnabled: false/g)).toHaveLength(2);
	});
});
