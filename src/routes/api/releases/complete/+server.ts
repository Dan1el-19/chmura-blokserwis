import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { v2AppReleaseManifestInputSchema } from '@unisource/sdk/v2';
import type { RequestHandler } from './$types';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { promoteLatest } from '$lib/server/storage/releases';
import { getUserRole } from '$lib/server/roles';
import { logger } from '$lib/server/logger';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

const completeSchema = z
	.object({
		release_id: z.string().min(1),
		size: z.number().int().positive(),
		channel: z.enum(['stable', 'beta']),
		version_code: z.number().int().positive(),
		min_supported_version_code: z.number().int().positive(),
		rollout: z.number().int().min(0).max(100),
		sha256: z.string().regex(/^[a-f\d]{64}$/i),
		certificate_sha256: z.string().regex(/^[a-f\d]{64}$/i)
	})
	.superRefine((value, context) => {
		if (value.min_supported_version_code > value.version_code) {
			context.addIssue({
				code: 'custom',
				path: ['min_supported_version_code'],
				message: 'Minimalna wersja nie może być większa od versionCode'
			});
		}
	});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const parsed = completeSchema.safeParse(await event.request.json().catch(() => null));

	if (!parsed.success) {
		return json({ error: 'Invalid release manifest', details: parsed.error.issues }, { status: 400 });
	}

	const {
		release_id,
		size,
		channel,
		version_code,
		min_supported_version_code,
		rollout,
		sha256,
		certificate_sha256
	} = parsed.data;

	try {
		const client = await createRequestAdminUnisourceClient(event);
		const result = unwrapItem(await client.releases.uploadComplete(release_id, size));
		await client.releases.putAppManifest(release_id, {
			...v2AppReleaseManifestInputSchema.parse({
				version_code,
				min_supported_version_code,
				sha256: sha256.toLowerCase(),
				certificate_sha256: certificate_sha256.toLowerCase(),
				channel,
				status: 'published',
				rollout
			})
		});

		// Promote this release to `latest` within its channel, stripping `latest` from previous
		const ch = typeof channel === 'string' ? channel : 'stable';
		await promoteLatest(ch, release_id, event);

		return json(result);
	} catch (error: any) {
		logger.error('Failed to complete release upload:', error);
		return json({ error: 'Failed to complete release upload' }, { status: 500 });
	}
};
