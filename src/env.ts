import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_CLERK_PUBLISHABLE_KEY: {
		public: true,
		schema: (value) => value ?? ''
	},
	PUBLIC_CLOUD_API_URL: {
		public: true,
		schema: (value) => value ?? 'https://api.blokserwis.pl'
	}
});
