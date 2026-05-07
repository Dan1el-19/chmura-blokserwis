import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getRelease,
	updateRelease,
	deleteRelease,
	getReleaseDownloadUrl,
	listReleases
} from '$lib/server/storage/releases';
import { updateReleaseSchema } from '$lib/schemas';
import {
	getExternalAppConfig,
	updateExternalAppConfig,
	withRetry
} from '$lib/server/externalConfig';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params }) => {
	const { releaseId } = params;

	try {
		const { release, url } = await getReleaseDownloadUrl(releaseId);
		return json({ release, downloadUrl: url });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { releaseId } = params;

	const body = await request.json();
	const validated = updateReleaseSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	try {
		const release = await updateRelease(releaseId, validated.data);
		return json({ release });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { releaseId } = params;

	let releaseToDelete;
	try {
		releaseToDelete = await getRelease(releaseId);
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}

	// Extract version number dynamically
	const versionMatch = releaseToDelete.name.match(/[\w-]+-(\d+\.\d+\.\d+)\.apk$/);
	const versionToDelete = versionMatch ? versionMatch[1] : releaseToDelete.name;

	try {
		await deleteRelease(releaseId);

		// Re-sync logic to maintain continuity in app_config
		try {
			const externalConfig = await getExternalAppConfig();

			// Jeśli skasowano plik który przed chwilą był hostowany jako "latestVersion"
			if (externalConfig && externalConfig.latestVersion === versionToDelete) {
				const remainingReleases = await listReleases();

				if (remainingReleases.length > 0) {
					const nextLatest = remainingReleases[0];
					const nextVerMatch = nextLatest.name.match(/[\w-]+-(\d+\.\d+\.\d+)\.apk$/);
					const nextVersion = nextVerMatch ? nextVerMatch[1] : nextLatest.name;

					await withRetry(() =>
						updateExternalAppConfig(
							'stable',
							nextVersion,
							false,
							nextLatest.notes || undefined,
							nextLatest.size
						)
					);

					if (!nextLatest.tags?.includes('latest')) {
						const updatedTags = [...(nextLatest.tags || []), 'latest'];
						await updateRelease(nextLatest.$id, { tags: updatedTags });
					}

					logger.info(
						`Reverted external config to version ${nextVersion} after deleting ${versionToDelete}.`
					);
				} else {
					// Fallback kiedy skasują wszystko z serwera
					await withRetry(() =>
						updateExternalAppConfig(
							'stable',
							'',
							false,
							'System holds no viable releases available',
							0
						)
					);
					logger.info(`Cleared external config as all releases were entirely deleted.`);
				}
			}
		} catch (syncError) {
			logger.error('Failed to safely re-sync app config during a release deletion: ', syncError);
		}

		return json({ success: true });
	} catch {
		return json({ error: 'Failed to safely delete release' }, { status: 500 });
	}
};
