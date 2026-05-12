import { describe, expect, it } from 'vitest';

import { assertPresignedUrlMatchesR2Config, assertR2Endpoint } from './r2-url';

const endpoint = 'https://0435db96c4078cd58f12162e0b83cee0.r2.cloudflarestorage.com';
const bucket = 'chmura-blokserwis';

describe('R2 URL validation', () => {
	it('accepts a virtual-hosted presigned URL for the configured bucket', () => {
		expect(() =>
			assertPresignedUrlMatchesR2Config(
				`https://${bucket}.0435db96c4078cd58f12162e0b83cee0.r2.cloudflarestorage.com/uploads/file.jpg?X-Amz-Signature=abc`,
				endpoint,
				bucket
			)
		).not.toThrow();
	});

	it('accepts a path-style presigned URL on the configured endpoint', () => {
		expect(() =>
			assertPresignedUrlMatchesR2Config(
				`${endpoint}/${bucket}/uploads/file.jpg?X-Amz-Signature=abc`,
				endpoint,
				bucket
			)
		).not.toThrow();
	});

	it('rejects a presigned URL generated against a different bucket host', () => {
		expect(() =>
			assertPresignedUrlMatchesR2Config(
				`https://blokserwis.0435db96c4078cd58f12162e0b83cee0.r2.cloudflarestorage.com/${bucket}/uploads/file.jpg?X-Amz-Signature=abc`,
				endpoint,
				bucket
			)
		).toThrow('does not match configured R2 bucket');
	});

	it('rejects a Cloudflare R2 endpoint that includes an extra bucket subdomain', () => {
		expect(() =>
			assertR2Endpoint(
				'https://blokserwis.0435db96c4078cd58f12162e0b83cee0.r2.cloudflarestorage.com'
			)
		).toThrow('must be the account-level R2 endpoint');
	});
});
