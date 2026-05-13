import { describe, expect, it, vi } from 'vitest';

const s3Client = vi.hoisted(() => vi.fn());
const assertR2Endpoint = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-s3', () => ({
	S3Client: s3Client
}));

vi.mock('$lib/server/env', () => ({
	ENV: {
		R2_ENDPOINT: 'https://account-id.r2.cloudflarestorage.com',
		R2_ACCESS_KEY_ID: 'access-key',
		R2_SECRET_ACCESS_KEY: 'secret-key',
		R2_BUCKET_NAME: 'bucket'
	}
}));

vi.mock('$lib/server/storage/r2-url', () => ({
	assertR2Endpoint
}));

describe('R2 client', () => {
	it('uses checksum settings compatible with Cloudflare R2', async () => {
		await import('./r2');

		expect(assertR2Endpoint).toHaveBeenCalledWith('https://account-id.r2.cloudflarestorage.com');
		expect(s3Client).toHaveBeenCalledWith(
			expect.objectContaining({
				requestChecksumCalculation: 'WHEN_REQUIRED',
				responseChecksumValidation: 'WHEN_REQUIRED'
			})
		);
	});
});
