import { Client, TablesDB, AppwriteException } from 'node-appwrite';
import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { logger } from './logger';

const DB_ID = 'blokserwis-db';
const TABLE_ID = 'app_config';
const ROW_ID = 'config';

function getExternalClient() {
	if (!env.RELEASES_APPWRITE_API_KEY || !env.RELEASES_APPWRITE_PROJECT_ID) {
		throw new Error('External app config keys missing. Sync operations skipped.');
	}

	const client = new Client()
		.setEndpoint(env.RELEASES_APPWRITE_ENDPOINT || PUBLIC_APPWRITE_ENDPOINT)
		.setProject(env.RELEASES_APPWRITE_PROJECT_ID)
		.setKey(env.RELEASES_APPWRITE_API_KEY);

	return new TablesDB(client);
}

export type ExternalAppConfig = {
	latestVersion: string;
	forceUpdate: boolean;
	changelog: string;
	apkSizeBytes: number;
    updatedAt?: string;
};

// Helper for fetching Appwrite external sync document
export async function getExternalAppConfig(): Promise<ExternalAppConfig | null> {
    try {
        const tablesDB = getExternalClient();
        const doc = await tablesDB.getRow({
			databaseId: DB_ID,
			tableId: TABLE_ID,
			rowId: ROW_ID
		});
        
        return {
            latestVersion: doc.latestVersion as string,
            forceUpdate: doc.forceUpdate as boolean,
            changelog: doc.changelog as string,
            apkSizeBytes: doc.apkSizeBytes as number,
            updatedAt: doc.$updatedAt as string
        };
    } catch (error: any) {
        if (error instanceof AppwriteException && error.code === 404) {
			return null;
		}
        logger.error('Failed to get external app config:', error);
        throw error;
    }
}

// Helper for Appwrite external sync update
export async function updateExternalAppConfig(
	version: string,
	forceUpdate: boolean,
	changelog: string | undefined,
	apkSizeBytes: number
) {
	const tablesDB = getExternalClient();

	const data = {
		latestVersion: version,
		forceUpdate: forceUpdate,
		changelog: changelog || '',
		apkSizeBytes: apkSizeBytes
	};

	try {
		return await tablesDB.updateRow({
			databaseId: DB_ID,
			tableId: TABLE_ID,
			rowId: ROW_ID,
			data
		});
	} catch (error: any) {
		if (error instanceof AppwriteException && error.code === 404) {
			return await tablesDB.createRow({
				databaseId: DB_ID,
				tableId: TABLE_ID,
				rowId: ROW_ID,
				data
			});
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
				await new Promise(res => setTimeout(res, backoff));
				continue;
			}
			throw error;
		}
	}
	throw lastError;
}
