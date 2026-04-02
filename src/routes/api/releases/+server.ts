import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	listReleases,
	createRelease,
	getReleaseByName,
	deleteRelease,
	updateRelease
} from '$lib/server/storage/releases';
import { createReleaseSchema } from '$lib/schemas';
import { deleteR2Object } from '$lib/server/storage/r2';
import { logger } from '$lib/server/logger';
import { updateExternalAppConfig, withRetry } from '$lib/server/externalConfig';

export const GET: RequestHandler = async () => {
	const releases = await listReleases();
	return json({ releases });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const validated = createReleaseSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { name, size, r2Key, tags, notes, forceUpdate, channel, apkStoragePath } = validated.data;

	// Check if release with same name exists and overwrite flag is set
	const existing = await getReleaseByName(name);
	if (existing && !body.overwrite) {
		return json(
			{
				error: 'conflict',
				message: 'Release with this name already exists',
				existing
			},
			{ status: 409 }
		);
	}

	// If overwriting, delete old release first
	if (existing && body.overwrite) {
		await deleteRelease(existing.$id);
	}

	// Extract version from name if possible (e.g. blokserwis-1.0.0.apk -> 1.0.0)
	// Also extract pre-release version (e.g. blokserwis-1.10.0-dev.3.apk -> 1.10.0-dev.3)
	const versionMatch = name.match(/[\w\-]+-(\d+\.\d+\.\d+(?:[.-][\w.]+)?)\.apk$/i);
	const version = versionMatch ? versionMatch[1] : name;
	const resolvedStoragePath = apkStoragePath ?? `${channel}/${name}`;

	let release;
	try {
		release = await createRelease({
			name,
			size,
			r2Key,
			tags,
			uploadedBy: user.$id,
			notes
		});
	} catch (error: any) {
		logger.error('Failed to create release locally:', error);
		return json({ error: error?.message || 'Failed to register release in local DB' }, { status: 500 });
	}

	// Post-create tag shift:
	try {
		const allReleases = await listReleases();
		for (const r of allReleases) {
			if (r.$id !== release.$id && r.tags?.includes('latest')) {
				const updatedTags = r.tags.filter((t: string) => t !== 'latest');
				await updateRelease(r.$id, { tags: updatedTags });
			}
		}

		if (!release.tags?.includes('latest')) {
			const newTags = [...(release.tags || []), 'latest'];
			release = await updateRelease(release.$id, { tags: newTags });
		}
	} catch (e) {
		logger.warn('Failed to shift latest tag across releases: ', e);
	}

	// Post-create sync
	try {
		await withRetry(() =>
			updateExternalAppConfig(channel, version, forceUpdate ?? false, notes, size, resolvedStoragePath)
		);
		logger.info('External app config updated successfully');
		return json({ release }, { status: 201 });
	} catch (error: any) {
		const message = error?.message || 'Failed to register release in DB';

		// Some deployments may fail during post-create remote config sync.
		// If the row was already created, return success with a warning.
		if (message.includes('release created in local db only')) {
			const fallbackRelease = await getReleaseByName(name);
			if (fallbackRelease) {
				logger.warn('Release created with warning:', message);
				return json({ release: fallbackRelease, warning: message }, { status: 201 });
			}
		}

		logger.error('Failed to create release:', error);
		return json({ error: message }, { status: 500 });
	}
};
