import { describe, expect, it } from 'vitest';
import { readWizardLocation, wizardHref } from './wizard-state.js';

describe('wizard resume links', () => {
	it('resumes the saved stage without requesting AI again', () => {
		expect(readWizardLocation(new URL('https://example.test/wyceny/q1'), 'agent')).toEqual({ stage: 'agent', editing: false });
	});
	it('uses a valid explicit history stage and edit mode', () => {
		expect(readWizardLocation(new URL('https://example.test/wyceny/q1?step=preview&edit=1'), 'review')).toEqual({ stage: 'preview', editing: true });
	});
	it('ignores malformed stages and disallows editing an import or summary', () => {
		expect(readWizardLocation(new URL('https://example.test/wyceny/q1?step=unknown&edit=1'), 'summary')).toEqual({ stage: 'summary', editing: false });
	});
	it('preserves unrelated query values while dropping edit mode on stage changes', () => {
		expect(wizardHref(new URL('https://example.test/wyceny/q1?view=mine&edit=1'), 'agent')).toBe('/wyceny/q1?view=mine&step=agent');
	});
});
