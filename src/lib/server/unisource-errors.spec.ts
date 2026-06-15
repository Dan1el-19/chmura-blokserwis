import { UnisourceV2Error } from '@unisource/sdk/v2';
import { describe, expect, it } from 'vitest';

import { publicShareErrorState, unisourceErrorResponse } from './unisource-errors';

describe('UniSource V2 errors', () => {
	it('returns the V2 status, code, request id and message', async () => {
		const response = unisourceErrorResponse(
			new UnisourceV2Error('Brak dostępu', 403, 'forbidden', 'req_123')
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Brak dostępu',
			code: 'forbidden',
			requestId: 'req_123'
		});
	});

	it.each([
		['forbidden', 403, false, true],
		['gone', 410, true, false]
	] as const)('maps %s public share errors', (code, status, expired, limitReached) => {
		expect(
			publicShareErrorState(new UnisourceV2Error('Public error', status, code, 'req_1'))
		).toMatchObject({
			expired,
			limitReached
		});
	});

	it('does not expose unknown internal error details', async () => {
		const response = unisourceErrorResponse(new Error('sensitive stack detail'));

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'UniSource request failed' });
	});
});
