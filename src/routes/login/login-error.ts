const USER_LIMIT_MESSAGE =
	'Tworzenie nowych kont jest niemożliwe. Skontaktuj się z administratorem systemu.';

type AppwriteFailure = {
	message?: unknown;
	type?: unknown;
	code?: unknown;
};

export function getLoginFailureToastMessage(params: URLSearchParams): string | null {
	if (params.get('failure') !== 'true') return null;

	const rawError = params.get('error');
	if (!rawError) return null;

	try {
		const parsed = JSON.parse(rawError) as AppwriteFailure;
		if (
			parsed.type === 'user_count_exceeded' ||
			String(parsed.message ?? '')
				.toLowerCase()
				.includes('maximum number of users')
		) {
			return USER_LIMIT_MESSAGE;
		}
	} catch {
		return null;
	}

	return null;
}
