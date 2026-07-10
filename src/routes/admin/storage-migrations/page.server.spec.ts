import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({ requestAdminUnisourceV2 }));

import { actions, load } from './+page.server';

describe('/admin/storage-migrations', () => {
	beforeEach(() => requestAdminUnisourceV2.mockReset());

	it('loads the migration dashboard through the server-side UniSource adapter', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({ item: { recent_runs: [], recent_events: [] } });

		await load({ locals: { user: { $id: 'admin-1' } } } as never);

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/v2/admin/storage-migrations'
		);
	});

	it('starts an explicit dry run through UniSource', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({ item: { id: 'run-1' } });

		const result = await actions.startRun({
			locals: { user: { $id: 'admin-1' } },
			request: new Request('https://chmura.example/admin/storage-migrations', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ dry_run: 'true' })
			})
		} as never);

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'POST',
			'/v2/admin/storage-migrations/runs',
			{ body: { dry_run: true } }
		);
		expect(result).toEqual({ success: true, dryRun: true, runId: 'run-1', runnerWarning: null });
	});
});
