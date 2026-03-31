import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReleases, createRelease, getReleaseByName, deleteRelease, updateRelease } from '$lib/server/storage/releases';
import { createReleaseSchema } from '$lib/schemas';
import { deleteR2Object } from '$lib/server/storage/r2';
import { logger } from '$lib/server/logger';
import { Client, TablesDB, AppwriteException } from 'node-appwrite';
import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID } from '$env/static/public';
import { env } from '$env/dynamic/private';
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
		return json(
			{ error: 'Validation error', details: validated.error.issues },
			{ status: 400 }
		);
	}

	const { name, size, r2Key, tags, notes, forceUpdate } = validated.data;

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

	if (existing && body.overwrite) {
		await deleteRelease(existing.$id);
	}

	// Extract version from name if possible (e.g. blokserwis-1.0.0.apk -> 1.0.0)
	const versionMatch = name.match(/[\w\-]+-(\d+\.\d+\.\d+)\.apk$/);
	const version = versionMatch ? versionMatch[1] : name;

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

	// Post-create sync
	try {
		await withRetry(() => updateExternalAppConfig(version, forceUpdate ?? false, notes, size));
		logger.info('External app config updated successfully');
		return json({ release }, { status: 201 });
	} catch (error: any) {
		logger.error('Failed to update remote app config:', error);
		
		// Ostrzeżenie do klienta o błędzie z zewnętrzną bazą, mimo że plik jest już bezpieczny
		const message = 'Failed to update remote app config, release created in local db only';
		logger.warn('Release created with warning:', message);
		return json({ release: release, warning: message }, { status: 201 });
	}
};
