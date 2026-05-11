import {
	getPublicFileInfo as getPublicFileInfoFromSdk,
	UnisourceClient,
	unlockPublicFile as unlockPublicFileFromSdk
} from '@unisource/sdk';
import type { RequestEvent } from '@sveltejs/kit';

import { createSessionClient } from './appwrite';
import { requireRuntimeEnv } from './runtime-env';

function getConfig(event: Pick<RequestEvent, 'platform'> | undefined) {
	return {
		baseUrl: requireRuntimeEnv(event, 'UNISOURCE_URL'),
		serviceId: requireRuntimeEnv(event, 'UNISOURCE_SERVICE_ID')
	};
}

export async function createUserUnisourceClient(event: RequestEvent): Promise<UnisourceClient> {
	const { account } = createSessionClient(event);
	const token = await account.createJWT({ duration: 900 });
	const { baseUrl, serviceId } = getConfig(event);

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
