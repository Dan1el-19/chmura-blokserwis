import { Client, Databases, AppwriteException } from 'node-appwrite';
import type { RequestEvent } from '@sveltejs/kit';
import { logger } from './logger';
import { requireRuntimeEnv } from './runtime-env';

const DB_ID = 'blokserwis-db';
const TABLE_ID = 'app_config';
type RuntimeEvent = Pick<RequestEvent, 'platform'> | undefined;

export type ReleaseChannel = 'stable' | 'beta';

const ROW_ID_MAP: Record<ReleaseChannel, string> = {
	stable: 'config_stable',
	beta: 'config_beta'
};

function getExternalClient(event?: RuntimeEvent) {
	const client = new Client()
		.setEndpoint(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_ENDPOINT'))
		.setProject(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_PROJECT_ID'))
		.setKey(requireRuntimeEnv(event, 'APPWRITE_API_KEY'));

	return new Databases(client);
}

export type ExternalAppConfig = {
	latestVersion: string;
	forceUpdate: boolean;
	changelog: string;
	apkSizeBytes: number;
	channel: ReleaseChannel;
	updatedAt?: string;
};

export async function getExternalAppConfig(
	channel: ReleaseChannel = 'stable',
	event?: RuntimeEvent
): Promise<ExternalAppConfig | null> {
	const rowId = ROW_ID_MAP[channel];
	try {
		const databases = getExternalClient(event);
		const doc = await databases.getDocument(DB_ID, TABLE_ID, rowId);

		return {
			latestVersion: doc.latestVersion as string,
			forceUpdate: doc.forceUpdate as boolean,
			changelog: doc.changelog as string,
			apkSizeBytes: doc.apkSizeBytes as number,
			channel,
			updatedAt: doc.$updatedAt as string
		};
	} catch (error: any) {
		if (error instanceof AppwriteException && error.code === 404) {
			return null;
		}
		logger.error(`Failed to get external app config [${channel}]:`, error);
		throw error;
	}
}

export async function updateExternalAppConfig(
	channel: ReleaseChannel = 'stable',
	version: string,
	forceUpdate: boolean,
	changelog: string | undefined,
	apkSizeBytes: number,
	event?: RuntimeEvent
) {
	const rowId = ROW_ID_MAP[channel];
	const databases = getExternalClient(event);

	const data = {
		latestVersion: version,
		forceUpdate,
		changelog: changelog || '',
		apkSizeBytes
	};

	try {
		return await databases.updateDocument(DB_ID, TABLE_ID, rowId, data);
	} catch (error: any) {
		if (error instanceof AppwriteException && error.code === 404) {
			return await databases.createDocument(DB_ID, TABLE_ID, rowId, data);
		} else {
			throw error;
		}
	}
}

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastError: any;
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error: any) {
			lastError = error;
			const isNetworkError = !error.code && !error.status;
			const isServerError = error.code >= 500 && error.code < 600;
			if (isNetworkError || isServerError) {
				const backoff = Math.pow(2, i) * 500;
				logger.warn(`[Retry ${i + 1}/${maxRetries}] Retrying after ${backoff}ms`);
				await new Promise((res) => setTimeout(res, backoff));
				continue;
			}
			throw error;
		}
	}
	throw lastError;
}
