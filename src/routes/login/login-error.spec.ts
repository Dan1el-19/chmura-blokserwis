import { describe, expect, it } from 'vitest';
import { getLoginFailureToastMessage } from './login-error';

describe('getLoginFailureToastMessage', () => {
	it('returns a Polish account creation message for Appwrite user limit failures', () => {
		const params = new URLSearchParams({
			failure: 'true',
			error: JSON.stringify({
				message:
					'The current project has exceeded the maximum number of users. Please check your user limit in the Appwrite console.',
				type: 'user_count_exceeded',
				code: 400
			})
		});

		expect(getLoginFailureToastMessage(params)).toBe(
			'Tworzenie nowych kont jest niemożliwe. Skontaktuj się z administratorem systemu.'
		);
	});
});
