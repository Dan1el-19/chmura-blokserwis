export type QuotationErrorKind =
	| 'conflict'
	| 'validation'
	| 'not_found'
	| 'archived'
	| 'ai'
	| 'network'
	| 'unknown';

export interface QuotationErrorInfo {
	kind: QuotationErrorKind;
	message: string;
	code?: string;
	status?: number;
	requestId?: string;
}

interface ErrorLike {
	message?: unknown;
	status?: unknown;
	code?: unknown;
	rawCode?: unknown;
	requestId?: unknown;
}

const POLISH_MESSAGES: Record<string, string> = {
	quotation_revision_conflict:
		'Wycena została zmieniona w innym oknie. Wybierz wersję, którą chcesz zachować.',
	quotation_not_found: 'Nie znaleziono wyceny albo nie masz już do niej dostępu.',
	quotation_archived: 'Ta wycena jest zarchiwizowana i nie można jej teraz edytować.',
	quotation_invalid_items: 'Sprawdź pozycje wyceny. Co najmniej jedna z nich jest niepoprawna.',
	quotation_invalid_document: 'Dokument wyceny zawiera niepoprawne dane.',
	quotation_model_unavailable: 'Wybrany model AI jest obecnie niedostępny.',
	quotation_model_unsupported: 'Wybrany model nie obsługuje generowania tej wyceny.',
	quotation_ai_invalid_response: 'Model AI zwrócił niepoprawną odpowiedź. Spróbuj ponownie.',
	quotation_ai_provider_error: 'Usługa AI jest chwilowo niedostępna. Spróbuj ponownie później.',
	quotation_ai_operation_conflict: 'Inna operacja AI dla tej wyceny nadal trwa.',
	quotation_export_unavailable: 'Eksport tej wersji wyceny nie jest jeszcze dostępny.'
};

export function quotationErrorInfo(error: unknown): QuotationErrorInfo {
	if (!error || typeof error !== 'object') {
		return { kind: 'unknown', message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.' };
	}

	const value = error as ErrorLike;
	const code = text(value.rawCode) || text(value.code);
	const status = typeof value.status === 'number' ? value.status : undefined;
	const requestId = text(value.requestId) || undefined;
	const knownMessage = code ? POLISH_MESSAGES[code] : undefined;
	const kind = errorKind(code, status, text(value.message));

	return {
		kind,
		message: knownMessage ?? fallbackMessage(kind),
		...(code ? { code } : {}),
		...(status !== undefined ? { status } : {}),
		...(requestId ? { requestId } : {})
	};
}

export function isQuotationConflict(error: unknown): boolean {
	return quotationErrorInfo(error).kind === 'conflict';
}

function errorKind(code: string, status: number | undefined, message: string): QuotationErrorKind {
	if (status === 409 || code.includes('conflict')) return 'conflict';
	if (status === 404 || code === 'quotation_not_found') return 'not_found';
	if (code === 'quotation_archived') return 'archived';
	if (status === 400 || code.startsWith('quotation_invalid')) return 'validation';
	if (code.includes('_ai_') || code.includes('_model_')) return 'ai';
	if (/network|fetch|offline/i.test(message)) return 'network';
	return 'unknown';
}

function fallbackMessage(kind: QuotationErrorKind): string {
	switch (kind) {
		case 'conflict':
			return 'Wycena została zmieniona w innym oknie. Wybierz wersję, którą chcesz zachować.';
		case 'validation':
			return 'Sprawdź dane wyceny i popraw oznaczone pola.';
		case 'not_found':
			return 'Nie znaleziono wyceny albo nie masz już do niej dostępu.';
		case 'archived':
			return 'Ta wycena jest zarchiwizowana.';
		case 'ai':
			return 'Nie udało się wykonać operacji AI. Spróbuj ponownie.';
		case 'network':
			return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
		default:
			return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
	}
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}
