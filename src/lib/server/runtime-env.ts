import {
	PUBLIC_APPWRITE_ENDPOINT,
	PUBLIC_APPWRITE_PROJECT_ID,
	PUBLIC_APPWRITE_PROJECT_NAME
} from '$env/static/public';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestEvent } from '@sveltejs/kit';
import { normalizeAppwriteEnv, type RuntimeEnvMap } from './appwrite-env';

type RuntimeEvent = Pick<RequestEvent, 'platform'> | undefined;

function getPlatformEnv(event?: RuntimeEvent): RuntimeEnvMap {
	return (event?.platform?.env ?? {}) as RuntimeEnvMap;
}

export function getRuntimeEnv(event?: RuntimeEvent): RuntimeEnvMap {
	return normalizeAppwriteEnv({
		...privateEnv,
		PUBLIC_APPWRITE_ENDPOINT,
		PUBLIC_APPWRITE_PROJECT_ID,
		PUBLIC_APPWRITE_PROJECT_NAME,
		...getPlatformEnv(event)
	});
}

export function requireRuntimeEnv(event: RuntimeEvent, name: string): string {
	const value = getRuntimeEnv(event)[name];
	if (!value) {
		throw new Error(`Missing runtime environment binding: ${name}`);
	}
	return value;
}

export function getOptionalRuntimeEnv(event: RuntimeEvent, name: string): string | undefined {
	return getRuntimeEnv(event)[name];
}
