import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceDetail = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		admin: {
			serviceDetail
		}
	})
}));

import { load } from './+layout.server';

describe('root layout upload destination', () => {
	beforeEach(() => {
		serviceDetail.mockReset();
	});

	it('passes through the hybrid upload recommendation from UniSource', async () => {
		expect.assertions(1);

		serviceDetail.mockResolvedValue({
			service: { recommended_upload_destination: 'hybrid' }
		});

		const result = await load({
			locals: { user: { $id: 'user-1', labels: ['admin'] } },
			platform: undefined
		} as any);

		expect(result).toMatchObject({ recommendedUploadDestination: 'hybrid' });
	});
});
