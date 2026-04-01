import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease } from '$lib/server/storage/releases';
import { getExternalAppConfig, updateExternalAppConfig, withRetry } from '$lib/server/externalConfig';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const config = await getExternalAppConfig();
		return json({ config });
	} catch (error: any) {
		return json({ error: 'Failed to fetch remote config', details: error?.message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const { releaseId, forceUpdate } = body;

	if (!releaseId) {
		return json({ error: 'Missing releaseId' }, { status: 400 });
	}

	let release;
	try {
		release = await getRelease(releaseId);
	} catch (error: any) {
		return json({ error: 'Release not found in local db' }, { status: 404 });
	}

	const versionMatch = release.name.match(/[\w\-]+-(\d+\.\d+\.\d+)\.apk$/);
	const version = versionMatch ? versionMatch[1] : release.name;

	try {
		const result = await withRetry(() =>
			updateExternalAppConfig(version, forceUpdate === true, release.notes || undefined, release.size)
		);
		logger.info(`Force synced release ${version} to external app config`);
		return json({ success: true, config: result }, { status: 200 });
	} catch (error: any) {
		logger.error('Failed to sync release to remote app config:', error);
		return json({ error: 'Failed to sync to remote config DB', details: error?.message }, { status: 500 });
	}
};
