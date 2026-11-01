export type ClerkSessionForAuth = {
	id: string;
	status: string;
	currentTask?: { key: string } | null;
	getToken: () => Promise<string | null>;
};

export type ClerkAuthResolution<User> =
	| { status: 'signed-out'; user: null; error: null }
	| { status: 'pending'; user: null; error: string }
	| { status: 'signed-in'; user: User; error: null }
	| { status: 'error'; user: null; error: string };

export async function resolveClerkAuthState<User>(
	user: User | null,
	session: ClerkSessionForAuth | null,
	isCurrent: () => boolean
): Promise<ClerkAuthResolution<User> | null> {
	if (!isCurrent()) return null;

	if (!user || !session) {
		return { status: 'signed-out', user: null, error: null };
	}

	if (session.status === 'pending') {
		return {
			status: 'pending',
			user: null,
			error: getClerkPendingSessionMessage(session.currentTask?.key)
		};
	}

	if (session.status !== 'active') {
		return { status: 'signed-out', user: null, error: null };
	}

	let token: string | null;
	try {
		token = await session.getToken();
	} catch (error) {
		if (!isCurrent()) return null;
		return {
			status: 'error',
			user: null,
			error: error instanceof Error ? error.message : 'Nie udało się pobrać tokena sesji Clerk.'
		};
	}

	if (!isCurrent()) return null;
	if (!token) {
		return {
			status: 'error',
			user: null,
			error: 'Aktywna sesja Clerk nie zwróciła tokena. Odśwież stronę lub zaloguj się ponownie.'
		};
	}

	return { status: 'signed-in', user, error: null };
}

export function getClerkPendingSessionMessage(task?: string): string {
	switch (task) {
		case 'choose-organization':
			return 'Wybierz organizację, aby zakończyć logowanie.';
		case 'reset-password':
			return 'Zmień hasło, aby zakończyć logowanie.';
		case 'setup-mfa':
			return 'Dokończ konfigurację weryfikacji dwuetapowej.';
		default:
			return 'Dokończ wymagany krok logowania.';
	}
}
