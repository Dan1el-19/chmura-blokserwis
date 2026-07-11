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
	trigger: string | null;
	requested_by: string | null;
	files_total: number;
	files_completed: number;
	files_failed: number;
	bytes_transferred: number;
	progress_percent: number | null;
	started_at: string | null;
	finished_at: string | null;
	duration_ms: number | null;
};

type MigrationEvent = {
	id: string;
	run_id: string;
	item_id: string | null;
	file_id: string | null;
	event_type: string;
	level: 'info' | 'warning' | 'error';
	message: string;
	file_name: string | null;
	file_size: number | null;
	trigger: string | null;
	origin: string | null;
	source: {
		provider: 'r2';
		bucket: string | null;
		key: string | null;
	} | null;
	destination: {
		provider: 'appwrite';
		bucket: string | null;
		file_id: string | null;
	} | null;
	from_state: string | null;
	to_state: string | null;
	bytes_completed: number | null;
	expected_size: number | null;
	progress_percent: number | null;
	attempt_count: number | null;
	retry_at: string | null;
	error_code: string | null;
	error_message: string | null;
	duration_ms: number | null;
	metadata: Record<string, unknown>;
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
	trigger?: unknown;
	origin?: unknown;
	requested_by?: unknown;
	planned_count: number;
	migrated_count: number;
	failed_count: number;
	bytes_migrated: number;
	progress_percent?: unknown;
	started_at: number | string | null;
	finished_at: number | string | null;
	duration_seconds?: unknown;
	duration_ms?: unknown;
};

type RawMigrationEvent = {
	id: string;
	event_type: string;
	run_id?: unknown;
	item_id?: unknown;
	file_id?: unknown;
	bytes_completed?: unknown;
	metadata?: unknown;
	filename?: unknown;
	file_name?: unknown;
	file_size?: unknown;
	trigger?: unknown;
	origin?: unknown;
	source_provider?: unknown;
	source_bucket?: unknown;
	source_storage_key?: unknown;
	destination_provider?: unknown;
	destination_bucket?: unknown;
	destination_file_id?: unknown;
	state_from?: unknown;
	state_to?: unknown;
	current_state?: unknown;
	expected_size?: unknown;
	progress_percent?: unknown;
	attempt_count?: unknown;
	next_retry_at?: unknown;
	retry_at?: unknown;
	duration_seconds?: unknown;
	duration_ms?: unknown;
	error_code?: unknown;
	error_message?: unknown;
	message?: unknown;
	level?: unknown;
	created_at: number | string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseMetadata(value: unknown): Record<string, unknown> {
	const record = asRecord(value);
	if (record) return record;
	if (typeof value !== 'string') return value == null ? {} : { raw: value };

	try {
		const parsed = JSON.parse(value) as unknown;
		return asRecord(parsed) ?? { raw: parsed };
	} catch {
		return { raw: value };
	}
}

function stringValue(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value;
	}
	return null;
}

function numberValue(...values: unknown[]): number | null {
	for (const value of values) {
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string' && value.trim()) {
			const number = Number(value);
			if (Number.isFinite(number)) return number;
		}
	}
	return null;
}

function timestampToIso(value: unknown): string | null {
	if (typeof value === 'string' && value.trim() && !Number.isFinite(Number(value))) {
		const timestamp = Date.parse(value);
		return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
	}

	const timestamp = numberValue(value);
	if (timestamp === null) return null;
	const milliseconds = Math.abs(timestamp) >= 1_000_000_000_000 ? timestamp : timestamp * 1000;
	const date = new Date(milliseconds);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function eventLevel(eventType: string, explicitLevel: unknown): MigrationEvent['level'] {
	if (explicitLevel === 'info' || explicitLevel === 'warning' || explicitLevel === 'error') {
		return explicitLevel;
	}
	if (
		eventType.includes('retry') ||
		eventType.includes('skipped') ||
		eventType.includes('cancelled') ||
		eventType === 'source_cleanup_failed'
	) {
		return 'warning';
	}
	return eventType.includes('failed') ||
		eventType.includes('error') ||
		eventType.includes('conflicted')
		? 'error'
		: 'info';
}

function mapRun(run: RawMigrationRun): MigrationRun {
	const startedAt = timestampToIso(run.started_at);
	const finishedAt = timestampToIso(run.finished_at);
	const filesTotal = Number(run.planned_count ?? 0);
	const filesCompleted = Number(run.migrated_count ?? 0);
	const filesFailed = Number(run.failed_count ?? 0);
	const explicitDurationMs = numberValue(run.duration_ms);
	const durationSeconds = numberValue(run.duration_seconds);
	const calculatedDurationMs =
		startedAt && finishedAt ? Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)) : null;
	return {
		id: run.id,
		status: run.status,
		dry_run: Boolean(run.dry_run),
		trigger: stringValue(run.origin, run.trigger),
		requested_by: stringValue(run.requested_by),
		files_total: filesTotal,
		files_completed: filesCompleted,
		files_failed: filesFailed,
		bytes_transferred: Number(run.bytes_migrated ?? 0),
		progress_percent:
			numberValue(run.progress_percent) ??
			(filesTotal > 0 ? Math.min(100, ((filesCompleted + filesFailed) / filesTotal) * 100) : null),
		started_at: startedAt,
		finished_at: finishedAt,
		duration_ms:
			explicitDurationMs ??
			(durationSeconds === null ? calculatedDurationMs : durationSeconds * 1000)
	};
}

function mapEvent(event: RawMigrationEvent): MigrationEvent {
	const metadata = parseMetadata(event.metadata);
	const source = asRecord(metadata.source);
	const destination = asRecord(metadata.destination);
	const error = asRecord(metadata.error);
	const sourceBucket = stringValue(event.source_bucket, metadata.source_bucket, source?.bucket);
	const sourceKey = stringValue(
		event.source_storage_key,
		metadata.source_storage_key,
		metadata.source_key,
		source?.key
	);
	const sourceProvider = stringValue(
		event.source_provider,
		metadata.source_provider,
		source?.provider
	);
	const destinationBucket = stringValue(
		event.destination_bucket,
		metadata.destination_bucket,
		destination?.bucket
	);
	const destinationFileId = stringValue(
		event.destination_file_id,
		metadata.destination_file_id,
		metadata.appwrite_file_id,
		destination?.file_id
	);
	const destinationProvider = stringValue(
		event.destination_provider,
		metadata.destination_provider,
		destination?.provider
	);
	const durationMs = numberValue(event.duration_ms, metadata.duration_ms);
	const durationSeconds = numberValue(event.duration_seconds, metadata.duration_seconds);
	const createdAt = timestampToIso(event.created_at) ?? new Date(0).toISOString();
	const eventType = event.event_type || 'unknown';
	const errorMessage = stringValue(
		event.error_message,
		metadata.error_message,
		error?.message,
		typeof metadata.error === 'string' ? metadata.error : null
	);
	return {
		id: event.id,
		run_id: stringValue(event.run_id, metadata.run_id) ?? '',
		item_id: stringValue(event.item_id, metadata.item_id),
		file_id: stringValue(event.file_id, metadata.file_id),
		event_type: eventType,
		level: eventLevel(eventType, event.level ?? metadata.level),
		message: stringValue(event.message, metadata.message) ?? eventType.replaceAll('_', ' '),
		file_name: stringValue(event.filename, event.file_name, metadata.filename, metadata.file_name),
		file_size: numberValue(event.file_size, metadata.file_size, metadata.size),
		trigger: stringValue(event.trigger, metadata.trigger),
		origin: stringValue(event.origin, metadata.origin),
		source:
			sourceProvider === 'r2' || sourceBucket !== null || sourceKey !== null
				? { provider: 'r2', bucket: sourceBucket, key: sourceKey }
				: null,
		destination:
			destinationProvider === 'appwrite' || destinationBucket !== null || destinationFileId !== null
				? { provider: 'appwrite', bucket: destinationBucket, file_id: destinationFileId }
				: null,
		from_state: stringValue(
			event.state_from,
			metadata.state_from,
			metadata.from_state,
			metadata.previous_state
		),
		to_state: stringValue(
			event.state_to,
			event.current_state,
			metadata.state_to,
			metadata.to_state,
			metadata.current_state,
			metadata.state
		),
		bytes_completed: numberValue(event.bytes_completed, metadata.bytes_completed),
		expected_size: numberValue(event.expected_size, metadata.expected_size),
		progress_percent: numberValue(event.progress_percent, metadata.progress_percent),
		attempt_count: numberValue(event.attempt_count, metadata.attempt_count, metadata.attempt),
		retry_at: timestampToIso(
			event.next_retry_at ?? event.retry_at ?? metadata.next_retry_at ?? metadata.retry_at
		),
		error_code: stringValue(event.error_code, metadata.error_code, error?.code),
		error_message: errorMessage,
		duration_ms: durationMs ?? (durationSeconds === null ? null : durationSeconds * 1000),
		metadata,
		created_at: createdAt
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
