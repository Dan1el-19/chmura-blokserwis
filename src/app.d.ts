/// <reference types="@sveltejs/adapter-cloudflare" />

declare global {
	namespace App {
		interface Locals {
			user: import('appwrite').Models.User<import('appwrite').Models.Preferences> | undefined;
			authProvider: 'appwrite' | 'clerk' | undefined;
			clerkSessionToken: string | undefined;
		}

		interface PageState {
			previewFileId?: string;
		}

		interface Platform {
			env: Env;
		}
	}
}

export {};
