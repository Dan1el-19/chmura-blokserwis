import type { Clerk } from '@clerk/clerk-js';

type ClerkUiConstructor = NonNullable<NonNullable<Parameters<Clerk['load']>[0]>['ui']>['ClerkUI'];

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		Clerk?: Clerk;
		__internal_ClerkUICtor?: ClerkUiConstructor;
	}

	interface Env extends Cloudflare.Env {
		ASSETS: Fetcher;
		PUBLIC_CLERK_PUBLISHABLE_KEY: string;
		PUBLIC_CLOUD_API_URL: string;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			cloudFilePreview?: string;
		}
	}
}

export {};
