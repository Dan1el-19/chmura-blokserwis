import { describe, expect, it, vi } from 'vitest';

const latest = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createRequestAdminUnisourceClient: () => ({
		releases: {
			latest
		}
	})
}));

import { GET } from './+server';

describe('/api/releases/sync GET', () => {
	it('unwraps the UniSource latest release envelope before returning config', async () => {
		expect.assertions(2);

		latest.mockResolvedValueOnce({
			item: {
				id: 'release-1',
				name: 'blokserwis-1.11.2.apk',
				size: 86214699
			}
		});

		const response = await GET({ locals: { user: { $id: 'user-1', labels: ['admin'] } } } as never);
		const body = await response.json();

		expect(body.config).toMatchObject({
			id: 'release-1',
			name: 'blokserwis-1.11.2.apk',
			size: 86214699
		});
		expect(body.config).not.toHaveProperty('item');
	});
});
