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

	it('maps run provenance, counters and timing for correlated history', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({
			item: {
				recent_runs: [
					{
						id: 'run-1',
						status: 'completed',
						dry_run: 0,
						trigger: 'manual',
						origin: 'fast_upload',
						requested_by: 'admin-1',
						planned_count: 3,
						migrated_count: 2,
						failed_count: 1,
						bytes_migrated: 4096,
						progress_percent: 100,
						started_at: 1_720_000_000,
						finished_at: 1_720_000_015,
						duration_seconds: 15
					}
				],
				recent_events: []
			}
		});

		const result = (await load({ locals: { user: { $id: 'admin-1' } } } as never)) as {
			dashboard: { recent_runs: unknown[] };
		};

		expect(result.dashboard.recent_runs).toEqual([
			{
				id: 'run-1',
				status: 'completed',
				dry_run: false,
				trigger: 'fast_upload',
				requested_by: 'admin-1',
				files_total: 3,
				files_completed: 2,
				files_failed: 1,
				bytes_transferred: 4096,
				progress_percent: 100,
				started_at: new Date(1_720_000_000 * 1000).toISOString(),
				finished_at: new Date(1_720_000_015 * 1000).toISOString(),
				duration_ms: 15_000
			}
		]);
	});

	it('preserves the complete correlation and transfer envelope for migration events', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({
			item: {
				recent_runs: [],
				recent_events: [
					{
						id: 'event-1',
						run_id: 'run-1',
						item_id: 'item-1',
						file_id: 'file-1',
						event_type: 'copy_progress',
						created_at: 1_720_000_000,
						bytes_completed: '524288',
						metadata: { trace_id: 'trace-1' },
						filename: 'archive.zip',
						file_size: 1_048_576,
						trigger: 'manual',
						origin: 'fast_upload',
						source_provider: 'r2',
						source_bucket: 'r2-uploads',
						source_storage_key: 'service-1/file-1',
						destination_provider: 'appwrite',
						destination_bucket: 'appwrite-files',
						destination_file_id: 'appwrite-1',
						state_from: 'copying',
						state_to: 'verifying',
						expected_size: 1_048_576,
						progress_percent: 50,
						attempt_count: 2,
						next_retry_at: 1_720_000_060,
						duration_seconds: 12.5,
						error_code: 'COPY_DELAYED',
						error_message: 'Copy is taking longer than expected'
					}
				]
			}
		});

		const result = (await load({ locals: { user: { $id: 'admin-1' } } } as never)) as {
			dashboard: { recent_events: unknown[] };
		};

		expect(result.dashboard.recent_events).toEqual([
			{
				id: 'event-1',
				run_id: 'run-1',
				item_id: 'item-1',
				file_id: 'file-1',
				event_type: 'copy_progress',
				level: 'info',
				message: 'copy progress',
				file_name: 'archive.zip',
				file_size: 1_048_576,
				trigger: 'manual',
				origin: 'fast_upload',
				source: { provider: 'r2', bucket: 'r2-uploads', key: 'service-1/file-1' },
				destination: {
					provider: 'appwrite',
					bucket: 'appwrite-files',
					file_id: 'appwrite-1'
				},
				from_state: 'copying',
				to_state: 'verifying',
				bytes_completed: 524_288,
				expected_size: 1_048_576,
				progress_percent: 50,
				attempt_count: 2,
				retry_at: new Date(1_720_000_060 * 1000).toISOString(),
				error_code: 'COPY_DELAYED',
				error_message: 'Copy is taking longer than expected',
				duration_ms: 12_500,
				metadata: { trace_id: 'trace-1' },
				created_at: new Date(1_720_000_000 * 1000).toISOString()
			}
		]);
	});

	it('keeps legacy raw events usable and parses their metadata without losing it', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({
			item: {
				recent_runs: [],
				recent_events: [
					{
						id: 'event-legacy',
						run_id: 'run-legacy',
						event_type: 'source_cleanup_failed',
						created_at: '2026-07-11T08:30:00.000Z',
						metadata: JSON.stringify({
							file_id: 'file-legacy',
							filename: 'legacy.pdf',
							source_bucket: 'legacy-r2',
							source_storage_key: 'legacy/key',
							appwrite_file_id: 'legacy-appwrite-id',
							retry_at: 1_720_000_120,
							error: { code: 'R2_DELETE_FAILED', message: 'R2 object could not be removed' }
						})
					}
				]
			}
		});

		const result = (await load({ locals: { user: { $id: 'admin-1' } } } as never)) as {
			dashboard: { recent_events: Array<Record<string, unknown>> };
		};
		const migrationEvent = result.dashboard.recent_events[0];

		expect(migrationEvent).toMatchObject({
			run_id: 'run-legacy',
			file_id: 'file-legacy',
			file_name: 'legacy.pdf',
			level: 'warning',
			source: { provider: 'r2', bucket: 'legacy-r2', key: 'legacy/key' },
			destination: { provider: 'appwrite', bucket: null, file_id: 'legacy-appwrite-id' },
			retry_at: new Date(1_720_000_120 * 1000).toISOString(),
			error_code: 'R2_DELETE_FAILED',
			error_message: 'R2 object could not be removed',
			created_at: '2026-07-11T08:30:00.000Z'
		});
		expect(migrationEvent?.metadata).toEqual({
			file_id: 'file-legacy',
			filename: 'legacy.pdf',
			source_bucket: 'legacy-r2',
			source_storage_key: 'legacy/key',
			appwrite_file_id: 'legacy-appwrite-id',
			retry_at: 1_720_000_120,
			error: { code: 'R2_DELETE_FAILED', message: 'R2 object could not be removed' }
		});
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
