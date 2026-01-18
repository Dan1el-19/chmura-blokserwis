import { z } from 'zod';
import { env as privateEnv } from '$env/dynamic/private';
import {
	PUBLIC_APPWRITE_ENDPOINT,
	PUBLIC_APPWRITE_PROJECT_ID,
	PUBLIC_APPWRITE_PROJECT_NAME
} from '$env/static/public';
import { logger } from '$lib/server/logger';

const envSchema = z.object({
	PUBLIC_APPWRITE_ENDPOINT: z.url({ message: 'Invalid Appwrite endpoint URL' }),
	PUBLIC_APPWRITE_PROJECT_ID: z.string().min(1, 'Appwrite Project ID is required'),
	PUBLIC_APPWRITE_PROJECT_NAME: z.string().min(1, 'Appwrite Project Name is required'),

	APPWRITE_API_KEY: z.string().min(1, 'Appwrite API Key is required'),

	R2_ENDPOINT: z.url({ message: 'Invalid R2 endpoint URL' }),
	R2_ACCESS_KEY_ID: z.string().min(1, 'R2 Access Key ID is required'),
	R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2 Secret Access Key is required'),
	R2_BUCKET_NAME: z.string().min(1, 'R2 Bucket Name is required'),

	UPSTASH_REDIS_REST_URL: z.url().optional(),
	UPSTASH_REDIS_REST_TOKEN: z.string().optional()
});

const envData = {
	PUBLIC_APPWRITE_ENDPOINT,
	PUBLIC_APPWRITE_PROJECT_ID,
	PUBLIC_APPWRITE_PROJECT_NAME,
	...privateEnv
};

const parsed = envSchema.safeParse(envData);

if (!parsed.success) {
	logger.error('❌ Invalid environment variables:');
	parsed.error.issues.forEach((issue) => {
		logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
	});
	throw new Error('Environment validation failed. Check your .env file.');
}

export const ENV = parsed.data;

export type Env = z.infer<typeof envSchema>;
