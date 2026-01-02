import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT_ID } from '$env/static/public';
import { APPWRITE_API_KEY } from '$env/static/private';
import { Client, Account, TablesDB, Users } from 'node-appwrite';
import { type RequestEvent } from '@sveltejs/kit';

export const SESSION_COOKIE = '__session';

export function createAdminClient() {
	const client = new Client()
		.setEndpoint(PUBLIC_APPWRITE_ENDPOINT)
		.setProject(PUBLIC_APPWRITE_PROJECT_ID)
		.setKey(APPWRITE_API_KEY);

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
		.setEndpoint(PUBLIC_APPWRITE_ENDPOINT)
		.setProject(PUBLIC_APPWRITE_PROJECT_ID);

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
