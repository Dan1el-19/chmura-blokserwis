export function unauthenticatedMessage(rawMessage: string): string {
	if (rawMessage === 'Brak aktywnej sesji Clerk.') {
		return 'Nie udało się odczytać tokena Clerk. Odśwież stronę, aby ponowić wczytanie sesji.';
	}
	return 'Backend nie zaakceptował tokena sesji. Odśwież stronę lub zaloguj się ponownie.';
}
