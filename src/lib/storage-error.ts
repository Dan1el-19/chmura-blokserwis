import { Code, ConnectError } from '@connectrpc/connect';
import { unauthenticatedMessage } from './session-error.js';
export function storageErrorMessage(error: unknown): string {
	if (error instanceof ConnectError) {
		if (error.rawMessage.includes('OPERATION_IN_PROGRESS')) return 'W tym folderze trwa przesyłanie. Zakończ lub anuluj transfer i spróbuj ponownie.';
		if (error.rawMessage.includes('TREE_TOO_LARGE')) return 'Nie można jednorazowo przenieść więcej niż 500 elementów wraz z zawartością kosza.';
		if (error.rawMessage.includes('STORAGE_UPLOADS_DISABLED'))
			return 'Wybrany tryb przesyłania nie jest obecnie dostępny dla tego konta. Wybierz R2 dla nowego przesyłania.';
		if (error.rawMessage.includes('UPLOADS_PAUSED'))
			return 'Przesyłanie plików jest tymczasowo wstrzymane. Spróbuj ponownie później.';
		if (error.rawMessage.includes('STORAGE_CAPACITY_EXCEEDED'))
			return 'Brak dostępnego miejsca w wybranym magazynie. Zwiększ limit lub wybierz magazyn z wolną przestrzenią.';
		if (error.rawMessage.includes('STORAGE_MEASUREMENT_UNAVAILABLE'))
			return 'Nie można teraz potwierdzić dostępnej przestrzeni. Przesyłanie nie zostało rozpoczęte; spróbuj ponownie później.';
		if (error.code === Code.Unauthenticated) {
			return unauthenticatedMessage(error.rawMessage);
		}
		if (error.code === Code.Aborted) {
			return 'Ten element zmienił się w międzyczasie. Widok został odświeżony; ponów akcję.';
		}
		if (error.code === Code.AlreadyExists) return 'Element o tej nazwie już istnieje.';
		if (error.code === Code.NotFound) return 'Nie znaleziono elementu. Odśwież widok.';
		return error.message || 'Nie udało się wykonać operacji.';
	}
	return error instanceof Error ? error.message : 'Nie udało się wykonać operacji.';
}
