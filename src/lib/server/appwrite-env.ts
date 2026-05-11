export type RuntimeEnvMap = Record<string, string | undefined>;

export function normalizeAppwriteEnv(env: RuntimeEnvMap): RuntimeEnvMap {
	return {
		...env,
		PUBLIC_APPWRITE_ENDPOINT: env.RELEASES_APPWRITE_ENDPOINT || env.PUBLIC_APPWRITE_ENDPOINT,
		PUBLIC_APPWRITE_PROJECT_ID: env.RELEASES_APPWRITE_PROJECT_ID || env.PUBLIC_APPWRITE_PROJECT_ID,
		APPWRITE_API_KEY: env.RELEASES_APPWRITE_API_KEY || env.APPWRITE_API_KEY
	};
}
