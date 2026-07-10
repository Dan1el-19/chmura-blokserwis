import { fail, redirect } from '@sveltejs/kit';
import { UnisourceV2Error } from '@unisource/sdk/v2';
import type { Actions, PageServerLoad } from './$types';

import { requestAdminUnisourceV2 } from '$lib/server/unisource';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

type MigrationStatus = 'planned' | 'running' | 'completed' | 'not_needed' | 'cancelled';

type MigrationRun = {
	id: string;
	status: MigrationStatus;
	dry_run: boolean;
	files_total: number;
	files_completed: number;
	files_failed: number;
	bytes_transferred: number;
	started_at: string | null;
	finished_at: string | null;
};

type MigrationEvent = {
	id: string;
	level: 'info' | 'warning' | 'error';
	message: string;
	file_name: string | null;
	created_at: string;
};

type MigrationDashboard = {
	r2_used_bytes: number;
	r2_high_watermark_bytes: number;
	r2_low_watermark_bytes: number;
	active_run: MigrationRun | null;
	recent_runs: MigrationRun[];
	recent_events: MigrationEvent[];
};

type RawMigrationRun = {
	id: string;
	status: MigrationStatus;
	dry_run: number | boolean;
	planned_count: number;
	migrated_count: number;
	failed_count: number;
	bytes_migrated: number;
	started_at: number | null;
	finished_at: number | null;
};

type RawMigrationEvent = {
	id: string;
	event_type: string;
	created_at: number;
};

function mapRun(run: RawMigrationRun): MigrationRun {
	return {
		id: run.id,
		status: run.status,
		dry_run: Boolean(run.dry_run),
		files_total: Number(run.planned_count ?? 0),
		files_completed: Number(run.migrated_count ?? 0),
		files_failed: Number(run.failed_count ?? 0),
		bytes_transferred: Number(run.bytes_migrated ?? 0),
		started_at: run.started_at ? new Date(run.started_at * 1000).toISOString() : null,
		finished_at: run.finished_at ? new Date(run.finished_at * 1000).toISOString() : null
	};
}

function mapEvent(event: RawMigrationEvent): MigrationEvent {
	const level = event.event_type.includes('failed')
		? 'error'
		: event.event_type.includes('retry') || event.event_type.includes('skipped')
			? 'warning'
			: 'info';
	return {
		id: event.id,
		level,
		message: event.event_type.replaceAll('_', ' '),
		file_name: null,
		created_at: new Date(event.created_at * 1000).toISOString()
	};
}

async function getDashboard(event: Parameters<PageServerLoad>[0]): Promise<MigrationDashboard> {
	return requestAdminUnisourceV2<unknown>(event, 'GET', '/v2/admin/storage-migrations').then(
		(response) => {
			const dashboard = unwrapItem<
				Omit<MigrationDashboard, 'active_run' | 'recent_runs' | 'recent_events'> & {
					active_run: RawMigrationRun | null;
					recent_runs: RawMigrationRun[];
					recent_events: RawMigrationEvent[];
				}
			>(response);
			return {
				...dashboard,
				active_run: dashboard.active_run ? mapRun(dashboard.active_run) : null,
				recent_runs: dashboard.recent_runs.map(mapRun),
				recent_events: dashboard.recent_events.map(mapEvent)
			};
		}
	);
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	return { dashboard: await getDashboard(event) };
};

export const actions: Actions = {
	startRun: async (event) => {
		if (!event.locals.user) {
			return fail(401, { error: 'Brak autoryzacji' });
		}

		const formData = await event.request.formData();
		const dryRun = formData.get('dry_run') === 'true';

		try {
			const response = await requestAdminUnisourceV2<{
				item: MigrationRun;
				runner_warning?: { message?: string } | null;
			}>(event, 'POST', '/v2/admin/storage-migrations/runs', {
				body: { dry_run: dryRun }
			});
			return {
				success: true,
				dryRun,
				runId: response.item.id,
				runnerWarning: response.runner_warning?.message ?? null
			};
		} catch (error) {
			if (error instanceof UnisourceV2Error) {
				return fail(error.status, { error: error.message || 'Nie udało się uruchomić migracji' });
			}
			return fail(500, { error: 'Nie udało się uruchomić migracji' });
		}
	}
};
