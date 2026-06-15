import { UnisourceV2Client } from '@unisource/sdk/v2';
import type { RequestEvent } from '@sveltejs/kit';

import { createSessionClient } from './appwrite';
import { requireRuntimeEnv } from './runtime-env';

const DEFAULT_UNISOURCE_SERVICE_ID = 'usrc';
const ensuredServiceUsers = new Map<string, Promise<void>>();

function getConfig(event: Pick<RequestEvent, 'platform'> | undefined) {
	return {
		baseUrl: requireRuntimeEnv(event, 'UNISOURCE_URL'),
		serviceId: requireRuntimeEnv(event, 'UNISOURCE_SERVICE_ID')
	};
}

async function ensureServiceUserAccess(event: RequestEvent, userId: string, serviceId: string) {
	if (serviceId === DEFAULT_UNISOURCE_SERVICE_ID) return;

	const cacheKey = `${serviceId}:${userId}`;
	let pending = ensuredServiceUsers.get(cacheKey);
	if (!pending) {
		pending = createAdminUnisourceClient(event)
			.admin.updateUser(userId, {})
			.then(() => undefined)
			.catch((error) => {
				ensuredServiceUsers.delete(cacheKey);
				throw error;
			});
		ensuredServiceUsers.set(cacheKey, pending);
	}

	await pending;
}

export async function createUserUnisourceClient(event: RequestEvent): Promise<UnisourceV2Client> {
	const { account } = createSessionClient(event);
	const { baseUrl, serviceId } = getConfig(event);
	const userId = event.locals.user?.$id ?? (await account.get()).$id;

	await ensureServiceUserAccess(event, userId, serviceId);

	return new UnisourceV2Client({
		baseUrl,
		serviceId,
		getToken: async () => (await account.createJWT({ duration: 900 })).jwt,
		silentBeta: true
	});
}

export function createAdminUnisourceClient(
	event?: Pick<RequestEvent, 'platform'>
): UnisourceV2Client {
	const { baseUrl, serviceId } = getConfig(event);
	const apiKey = requireRuntimeEnv(event, 'UNISOURCE_API_KEY');

	return new UnisourceV2Client({
		baseUrl,
		serviceId,
		apiKey,
		silentBeta: true
	});
}

export function createPublicUnisourceClient(
	event?: Pick<RequestEvent, 'platform'>
): UnisourceV2Client {
	const { baseUrl, serviceId } = getConfig(event);

	return new UnisourceV2Client({
		baseUrl,
		serviceId,
		silentBeta: true
	});
}

export function getPublicFileInfo(event: Pick<RequestEvent, 'platform'>, slug: string) {
	return createPublicUnisourceClient(event).public.getShareLink(slug);
}

export function unlockPublicFile(
	event: Pick<RequestEvent, 'platform'>,
	slug: string,
	password: string
) {
	return createPublicUnisourceClient(event).public.unlockShareLink(slug, { password });
}
