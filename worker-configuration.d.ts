/// <reference types="@cloudflare/workers-types" />

interface Env {
	PUBLIC_APPWRITE_ENDPOINT?: string;
	PUBLIC_APPWRITE_PROJECT_ID?: string;
	PUBLIC_APPWRITE_PROJECT_NAME?: string;
	APPWRITE_API_KEY?: string;
	UNISOURCE_URL?: string;
	UNISOURCE_SERVICE_ID?: string;
	UNISOURCE_API_KEY?: string;
	ORIGIN?: string;
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
	RELEASES_DATABASE_ID?: string;
	RELEASES_TABLE_ID?: string;
	RELEASES_BUCKET_ID?: string;
	RELEASES_SYNC_API_KEY?: string;
	R2_ACCOUNT_ID?: string;
	R2_ACCESS_KEY_ID?: string;
	R2_SECRET_ACCESS_KEY?: string;
	R2_BUCKET_NAME?: string;
}
