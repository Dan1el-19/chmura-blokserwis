import { UnisourceV2Client, UnisourceV2Error, isV2ErrorCode } from '@unisource/sdk/v2';
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

type V2Query = Record<string, string | number | boolean | null | undefined>;

type V2RawOptions = {
	query?: V2Query;
	body?: unknown;
};

type RuntimeEvent = Pick<RequestEvent, 'platform'> | RequestEvent | undefined;

function applyQuery(url: URL, query: V2Query | undefined) {
	if (!query) return;
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue;
		url.searchParams.set(key, value === null ? 'null' : String(value));
	}
}

function parseV2ErrorCode(code: unknown) {
	return typeof code === 'string' && isV2ErrorCode(code) ? code : 'unknown';
}

function hasSession(event: RuntimeEvent): event is RequestEvent {
	return Boolean(event && 'cookies' in event && 'locals' in event && event.locals.user);
}

async function resolveRawAdminAuthHeader(event: RuntimeEvent) {
	if (hasSession(event)) {
		const { account } = createSessionClient(event);
		const { jwt } = await account.createJWT({ duration: 900 });
		return `Bearer ${jwt}`;
	}

	return `Bearer ${requireRuntimeEnv(event, 'UNISOURCE_API_KEY')}`;
}

export async function requestAdminUnisourceV2<T>(
	event: RuntimeEvent,
	method: string,
	path: string,
	options: V2RawOptions = {}
): Promise<T> {
	const { baseUrl, serviceId } = getConfig(event);
	const url = new URL(path, baseUrl);
	applyQuery(url, options.query);

	const headers: Record<string, string> = {
		Authorization: await resolveRawAdminAuthHeader(event),
		'X-Service-ID': serviceId,
		Accept: 'application/json'
	};
	if (options.body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}

	const response = await fetch(url.toString(), {
		method,
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		const requestId = response.headers.get('X-Request-Id') ?? 'unknown';
		let error: { code?: unknown; message?: unknown; details?: unknown } = {};
		try {
			const payload = (await response.json()) as { error?: typeof error };
			error = payload.error ?? {};
		} catch {
			// Preserve the HTTP status when UniSource returns a non-JSON error.
		}

		const code = parseV2ErrorCode(error.code);
		throw new UnisourceV2Error(
			typeof error.message === 'string' ? error.message : response.statusText,
			response.status,
			code,
			requestId,
			error.details,
			code === 'unknown' && typeof error.code === 'string' ? error.code : undefined
		);
	}

	return (await response.json()) as T;
}

/** Raw JWT-scoped V2 request for contracts newer than the installed SDK. */
export async function requestUserUnisourceV2<T>(
	event: RequestEvent,
	method: string,
	path: string,
	options: V2RawOptions = {}
): Promise<T> {
	const { account } = createSessionClient(event);
	const { serviceId } = getConfig(event);
	const userId = event.locals.user?.$id ?? (await account.get()).$id;
	try {
		await ensureServiceUserAccess(event, userId, serviceId);
	} catch {
		// Preserve the normal JWT request as the authoritative access check.
	}
	return requestAdminUnisourceV2<T>(event, method, path, options);
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
