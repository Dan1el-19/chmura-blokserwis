import { describe, expect, it, vi } from 'vitest';

import { triggerDownload } from './download';

describe('triggerDownload', () => {
	it('uses the direct storage URL and triggers a browser download click', () => {
		expect.assertions(4);

		const click = vi.fn();
		const remove = vi.fn();
		const appendChild = vi.fn();
		const anchor = {
			href: '',
			download: '',
			rel: '',
			style: { display: '' },
			click,
			remove
		};

		vi.stubGlobal('document', {
			createElement: vi.fn(() => anchor),
			body: { appendChild }
		});

		triggerDownload(
			'https://fra.cloud.appwrite.io/v1/storage/buckets/bucket/files/file/download?token=secret',
			'photo.jpg'
		);

		expect(anchor.href).toBe(
			'https://fra.cloud.appwrite.io/v1/storage/buckets/bucket/files/file/download?token=secret'
		);
		expect(anchor.download).toBe('photo.jpg');
		expect(appendChild).toHaveBeenCalledWith(anchor);
		expect(click).toHaveBeenCalledOnce();

		vi.unstubAllGlobals();
	});
});
