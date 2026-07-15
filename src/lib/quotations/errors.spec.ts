import { describe, expect, it } from 'vitest';
import { isQuotationConflict, quotationErrorInfo } from './errors';

describe('quotation errors', () => {
	it('maps backend quotation codes to actionable Polish messages', () => {
		expect(
			quotationErrorInfo({
				status: 409,
				code: 'unknown',
				rawCode: 'quotation_revision_conflict',
				requestId: 'req-1'
			})
		).toEqual({
			kind: 'conflict',
			code: 'quotation_revision_conflict',
			status: 409,
			requestId: 'req-1',
			message: 'Wycena została zmieniona w innym oknie. Wybierz wersję, którą chcesz zachować.'
		});
	});

	it('recognizes network and validation failures without exposing technical messages', () => {
		expect(quotationErrorInfo(new Error('Network request failed: secret host')).kind).toBe(
			'network'
		);
		expect(quotationErrorInfo({ status: 400, message: 'zod error' })).toEqual({
			kind: 'validation',
			status: 400,
			message: 'Sprawdź dane wyceny i popraw oznaczone pola.'
		});
	});

	it('exposes a conflict predicate for autosave', () => {
		expect(isQuotationConflict({ code: 'quotation_revision_conflict' })).toBe(true);
		expect(isQuotationConflict({ status: 500 })).toBe(false);
	});
});
