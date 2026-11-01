import type { Clerk } from '@clerk/clerk-js';
import type { Readable } from 'svelte/store';

export const AUTH_CONTEXT = Symbol('unisource-cloud-auth');

export type AuthSnapshot = {
	status: 'loading' | 'signed-out' | 'pending' | 'signed-in' | 'error';
	user: Clerk['user'] | null;
	error: string | null;
};

export type AuthContext = {
	state: Readable<AuthSnapshot>;
	signOut: () => Promise<void>;
};
