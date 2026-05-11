import { Client, Account, TablesDB, Users } from 'node-appwrite';
import { type RequestEvent } from '@sveltejs/kit';

import { requireRuntimeEnv } from './runtime-env';

export const SESSION_COOKIE = '__session';

export function createAdminClient(event?: Pick<RequestEvent, 'platform'>) {
	const client = new Client()
		.setEndpoint(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_ENDPOINT'))
		.setProject(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_PROJECT_ID'))
		.setKey(requireRuntimeEnv(event, 'APPWRITE_API_KEY'));

	return {
		get account() {
			return new Account(client);
		},
		get tablesDB() {
			return new TablesDB(client);
		},
		get users() {
			return new Users(client);
		}
	};
}

export function createSessionClient(event: RequestEvent) {
	const client = new Client()
		.setEndpoint(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_ENDPOINT'))
		.setProject(requireRuntimeEnv(event, 'PUBLIC_APPWRITE_PROJECT_ID'));

	const session = event.cookies.get(SESSION_COOKIE);
	if (session) {
		client.setSession(session);
	}

	return {
		get account() {
			return new Account(client);
		},
		get tablesDB() {
			return new TablesDB(client);
		}
	};
}
