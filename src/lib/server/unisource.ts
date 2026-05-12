import {
	getPublicFileInfo as getPublicFileInfoFromSdk,
	UnisourceClient,
	unlockPublicFile as unlockPublicFileFromSdk
} from '@unisource/sdk';
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

export async function createUserUnisourceClient(event: RequestEvent): Promise<UnisourceClient> {
	const { account } = createSessionClient(event);
	const { baseUrl, serviceId } = getConfig(event);
	const userId = event.locals.user?.$id ?? (await account.get()).$id;

	await ensureServiceUserAccess(event, userId, serviceId);

	const token = await account.createJWT({ duration: 900 });

	return new UnisourceClient({
		baseUrl,
		serviceId,
		getToken: () => token.jwt
	});
}

export function createAdminUnisourceClient(
	event?: Pick<RequestEvent, 'platform'>
): UnisourceClient {
	const { baseUrl, serviceId } = getConfig(event);
	const apiKey = requireRuntimeEnv(event, 'UNISOURCE_API_KEY');

	return new UnisourceClient({
		baseUrl,
		serviceId,
		getToken: () => apiKey
	});
}

export function getPublicFileInfo(event: Pick<RequestEvent, 'platform'>, slug: string) {
	return getPublicFileInfoFromSdk(requireRuntimeEnv(event, 'UNISOURCE_URL'), slug);
}

export function unlockPublicFile(
	event: Pick<RequestEvent, 'platform'>,
	slug: string,
	password: string
) {
	return unlockPublicFileFromSdk(requireRuntimeEnv(event, 'UNISOURCE_URL'), slug, password);
}
