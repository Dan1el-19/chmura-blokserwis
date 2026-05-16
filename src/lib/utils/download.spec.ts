import { describe, expect, it, vi } from 'vitest';

import { triggerDownload } from './download';

describe('triggerDownload', () => {
	it('navigates directly to Appwrite token download URLs instead of proxying them', () => {
		expect.assertions(1);

		const location = { href: '' };
		vi.stubGlobal('window', { location });

		triggerDownload(
			'https://fra.cloud.appwrite.io/v1/storage/buckets/bucket/files/file/download?token=secret',
			'photo.jpg'
		);

		expect(location.href).toBe(
			'https://fra.cloud.appwrite.io/v1/storage/buckets/bucket/files/file/download?token=secret'
		);

		vi.unstubAllGlobals();
	});
});
