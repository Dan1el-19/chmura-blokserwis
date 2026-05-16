import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './+server';

describe('/api/proxy-download', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('follows safe HTTPS redirects from Appwrite download URLs', async () => {
		expect.assertions(4);

		const fetchSpy = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { Location: 'https://fra.cloud.appwrite.io/v1/storage/final-file' }
				})
			)
			.mockResolvedValueOnce(
				new Response('file-body', {
					status: 200,
					headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '9' }
				})
			);
		vi.stubGlobal('fetch', fetchSpy);

		const response = await GET({
			locals: { user: { $id: 'user-1' } },
			url: new URL(
				'http://localhost/api/proxy-download?url=https%3A%2F%2Ffra.cloud.appwrite.io%2Fv1%2Fstorage%2Fbuckets%2Fbucket%2Ffiles%2Ffile%2Fdownload%3Ftoken%3Dsecret&name=photo.jpg'
			),
			platform: undefined
		} as any);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('file-body');
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy).toHaveBeenNthCalledWith(
			2,
			'https://fra.cloud.appwrite.io/v1/storage/final-file',
			expect.objectContaining({ redirect: 'manual' })
		);

		vi.unstubAllGlobals();
	});
});
