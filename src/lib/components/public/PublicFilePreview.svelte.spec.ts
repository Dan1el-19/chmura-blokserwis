import { mount, unmount, flushSync } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PublicFilePreview from './PublicFilePreview.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('PublicFilePreview', () => {
	it('renders inline image preview for previewable media', async () => {
		component = mount(PublicFilePreview, {
			target: document.body,
			props: {
				fileName: 'photo.png',
				mimeType: 'image/png',
				previewUrl: 'https://example.com/photo.png',
				downloadUrl: 'https://example.com/photo.png?download=1'
			}
		});
		flushSync();

		const image = document.querySelector('img[alt="photo.png"]') as HTMLImageElement | null;
		expect(image).not.toBeNull();
		expect(image?.src).toBe('https://example.com/photo.png');
	});

	it('renders nothing when preview URL is missing', async () => {
		component = mount(PublicFilePreview, {
			target: document.body,
			props: {
				fileName: 'photo.png',
				mimeType: 'image/png',
				previewUrl: null,
				downloadUrl: 'https://example.com/photo.png?download=1'
			}
		});
		flushSync();

		expect(document.querySelector('img')).toBeNull();
	});
});
