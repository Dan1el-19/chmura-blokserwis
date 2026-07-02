import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { GET } from './+server';

describe('/api/folders/[folderId]/download GET', () => {
	it('returns 410 (Gone) - ZIP download not supported', async () => {
		const response = await GET({} as never);
		const body = await response.json();

		expect(response.status).toBe(410);
		expect(body).toEqual({
			error: 'ZIP folder download is not supported in this version'
		});
	});
});
