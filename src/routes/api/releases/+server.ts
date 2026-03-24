import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReleases, createRelease, getReleaseByName, deleteRelease, updateRelease } from '$lib/server/storage/releases';
import { createReleaseSchema } from '$lib/schemas';
import { deleteR2Object } from '$lib/server/storage/r2';
import { Client, TablesDB, AppwriteException } from 'node-appwrite';
import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID } from '$env/static/public';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const releases = await listReleases();
	return json({ releases });
};

async function updateExternalAppConfig(
	version: string,
	forceUpdate: boolean,
	changelog: string | undefined,
	apkSizeBytes: number
) {
	const client = new Client()
		.setEndpoint(env.RELEASES_APPWRITE_ENDPOINT || PUBLIC_APPWRITE_ENDPOINT)
		.setProject(env.RELEASES_APPWRITE_PROJECT_ID || '')
		.setKey(env.RELEASES_APPWRITE_API_KEY || '');

	const tablesDB = new TablesDB(client);
	const dbId = 'blokserwis-db';
	const tableId = 'app_config';
	const rowId = 'config';

	const data = {
		latestVersion: version,
		forceUpdate: forceUpdate,
		changelog: changelog || '',
		apkSizeBytes: apkSizeBytes
	};

	try {
		return await tablesDB.updateRow({
			databaseId: dbId,
			tableId: tableId,
			rowId: rowId,
			data
		});
	} catch (error: any) {
		if (error instanceof AppwriteException && error.code === 404) {
			return await tablesDB.createRow({
				databaseId: dbId,
				tableId: tableId,
				rowId: rowId,
				data
			});
		} else {
			throw error;
		}
	}
}

// Helper for exponential backoff retries on network/5xx errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastError: any;
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error: any) {
			lastError = error;
			// Only retry on network issues or 5xx server errors
			const isNetworkError = !error.code && !error.status; 
			const isServerError = error.code >= 500 && error.code < 600;
			
			if (isNetworkError || isServerError) {
				const backoff = Math.pow(2, i) * 500; // 500ms, 1000ms, 2000ms...
				console.log(`[Retry ${i + 1}/${maxRetries}] Retrying after ${backoff}ms due to ${error.message || 'network error'}`);
				await new Promise(res => setTimeout(res, backoff));
				continue;
			}
			// For 4xx errors (like 404, 400, 401, 403, 409), fail immediately
			throw error;
		}
	}
	throw lastError;
}

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

	// Check if release with same name exists and overwrite flag is set
	const existing = await getReleaseByName(name);
	if (existing && !validated.data.overwrite) {
		return json(
			{
				error: 'conflict',
				message: 'Release with this name already exists',
				existing
			},
			{ status: 409 }
		);
	}

	// Strict extraction from r2Key for releases/blokserwis-{version}.apk
	const versionMatch = r2Key.match(/^releases\/blokserwis-(\d+\.\d+\.\d+)\.apk$/);
	if (!versionMatch || name !== `blokserwis-${versionMatch[1]}.apk`) {
		return json(
			{ error: 'Validation error', message: 'r2Key must be exactly releases/blokserwis-X.Y.Z.apk and match filename' },
			{ status: 400 }
		);
	}
	const version = versionMatch[1];

	// Verify object exists in R2 and check its real size
	const { R2 } = await import('$lib/clients/r2');
	const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
	const { ENV } = await import('$lib/server/env');
	
	let realSize = size;
	let eTag = '';
	try {
		const head = await withRetry(() => R2.send(
			new HeadObjectCommand({
				Bucket: ENV.R2_BUCKET_NAME,
				Key: r2Key
			})
		));
		if (head.ContentLength) {
			realSize = head.ContentLength;
		}
		eTag = head.ETag ? head.ETag.replace(/"/g, '') : 'unknown';
	} catch (error) {
		console.error('Failed to verify object in R2:', error);
		return json({ error: 'Validation error', message: 'Object not found in R2 bucket' }, { status: 400 });
	}

	// Idempotency key based on version and ETag
	const idempotencyKey = `${version}-${eTag}`;
	console.log(`[Release] Tracking idempotency: ${idempotencyKey}`);

	// If overwriting, delete old release first but keep the R2 object
	if (existing && validated.data.overwrite) {
		await deleteRelease(existing.$id, true);
	}

	// Automate 'latest' tag: append it to the current release
	const finalTags = tags ? Array.from(new Set([...tags, 'latest'])) : ['latest'];

	const release = await createRelease({
		name,
		size: realSize,
		r2Key,
		tags: finalTags,
		uploadedBy: user.$id,
		notes
	});

	// Remove 'latest' tag from all other releases
	const allReleases = await listReleases();
	for (const r of allReleases) {
		if (r.$id !== release.$id && r.tags && r.tags.includes('latest')) {
			const filteredTags = r.tags.filter(t => t !== 'latest');
			await updateRelease(r.$id, { tags: filteredTags });
		}
	}

	try {
		// Appwrite DB is updated with exact extracted version and forceUpdate payload parameter
		// Wrapped in withRetry to harden against transient network drops
		const updatedConfig = await withRetry(() => updateExternalAppConfig(version, forceUpdate ?? false, notes, realSize));
		
		// Post-check logic: verifying what was actually saved
		if (updatedConfig.latestVersion !== version || updatedConfig.apkSizeBytes !== realSize) {
			console.error('Post-check mismatch! Appwrite saved different values than requested.');
		}
	} catch (error) {
		console.error('Failed to update app config:', error);
		return json({ error: 'Failed to update remote app config, release created in local db only' }, { status: 500 });
	}

	return json({ release }, { status: 200 });
};
