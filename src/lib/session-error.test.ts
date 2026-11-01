import { describe, expect, it } from 'vitest';
import { unauthenticatedMessage } from './session-error.js';

describe('unauthenticatedMessage', () => {
	it('distinguishes a missing local Clerk token from a backend rejection', () => {
		expect(unauthenticatedMessage('Brak aktywnej sesji Clerk.')).toContain('odczytać tokena Clerk');
		expect(unauthenticatedMessage('invalid token')).toBe(
			'Backend nie zaakceptował tokena sesji. Odśwież stronę lub zaloguj się ponownie.'
		);
	});
});
