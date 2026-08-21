import { beforeEach, describe, expect, it, vi } from 'vitest';

const getService = vi.hoisted(() => vi.fn());
const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		admin: {
			getService
		}
	}),
	createRequestAdminUnisourceClient: () => ({
		admin: {
			getService
		}
	}),
	requestAdminUnisourceV2
}));

import { load } from './+layout.server';

describe('root layout upload destination', () => {
	beforeEach(() => {
		getService.mockReset();
		requestAdminUnisourceV2.mockReset();
		requestAdminUnisourceV2.mockImplementation(() => getService());
	});

	it('passes through the hybrid upload recommendation from UniSource', async () => {
		expect.assertions(1);

		getService.mockResolvedValue({
			service: { recommended_upload_destination: 'hybrid' }
		});

		const result = await load({
			locals: { user: { $id: 'user-1', labels: ['admin'] } },
			platform: undefined
		} as any);

		expect(result).toMatchObject({ recommendedUploadDestination: 'hybrid' });
	});
});
