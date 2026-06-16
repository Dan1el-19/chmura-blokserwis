import { UnisourceV2Client } from '@unisource/sdk/v2';
import type { RequestEvent } from '@sveltejs/kit';

import { createSessionClient } from './appwrite';
import { requireRuntimeEnv } from './runtime-env';

const ensuredServiceUsers = new Map<string, Promise<void>>();

function getConfig(event: Pick<RequestEvent, 'platform'> | undefined) {
	return {
		baseUrl: requireRuntimeEnv(event, 'UNISOURCE_URL'),
		serviceId: requireRuntimeEnv(event, 'UNISOURCE_SERVICE_ID')
	};
}

async function ensureServiceUserAccess(event: RequestEvent, userId: string, serviceId: string) {
	const cacheKey = `${serviceId}:${userId}`;
	let pending = ensuredServiceUsers.get(cacheKey);
	if (!pending) {
		const role = event.locals.user?.labels?.includes('admin') ? 'admin' : 'user';
		pending = createAdminUnisourceClient(event)
			.admin.updateUser(userId, { role })
			.then(() => undefined)
			.catch((error) => {
				ensuredServiceUsers.delete(cacheKey);
				throw error;
			});
		ensuredServiceUsers.set(cacheKey, pending);
	}

	await pending;
}

async function createJwtUnisourceClient(event: RequestEvent): Promise<UnisourceV2Client> {
	const { account } = createSessionClient(event);
	const { baseUrl, serviceId } = getConfig(event);

	return new UnisourceV2Client({
		baseUrl,
		serviceId,
		getToken: async () => (await account.createJWT({ duration: 900 })).jwt,
		silentBeta: true
	});
}

export async function createUserUnisourceClient(event: RequestEvent): Promise<UnisourceV2Client> {
	const { account } = createSessionClient(event);
	const { serviceId } = getConfig(event);
	const userId = event.locals.user?.$id ?? (await account.get()).$id;

	try {
		await ensureServiceUserAccess(event, userId, serviceId);
	} catch {
		// Let the JWT-scoped request below decide whether the user already has
		// access. A non-admin service API key must not make every user read fail.
	}

	return createJwtUnisourceClient(event);
}

export function createRequestAdminUnisourceClient(event: RequestEvent): Promise<UnisourceV2Client> {
	return createUserUnisourceClient(event);
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
