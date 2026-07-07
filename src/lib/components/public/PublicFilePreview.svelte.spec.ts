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
	it('renders an inline preview for previewable media', async () => {
		component = mount(PublicFilePreview, {
			target: document.body,
			props: {
				fileName: 'photo.png',
				mimeType: 'image/png',
				previewUrl: 'https://example.com/photo.png',
				downloadUrl: 'https://example.com/photo.png?download=1',
				fileSize: 1234
			}
		});
		flushSync();

		const preview = document.querySelector('[aria-label="Podgląd pliku photo.png"]');
		const image = preview?.querySelector('img[alt="photo.png"]') as HTMLImageElement | null;
		expect(preview).not.toBeNull();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(image).not.toBeNull();
		expect(image?.src).toBe('https://example.com/photo.png');
	});

	it('renders no preview when both preview and download URLs are missing', async () => {
		component = mount(PublicFilePreview, {
			target: document.body,
			props: {
				fileName: 'photo.png',
				mimeType: 'image/png',
				previewUrl: null,
				downloadUrl: null
			}
		});
		flushSync();

		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(document.querySelector('[aria-label^="Podgląd pliku"]')).toBeNull();
	});

	it('renders an inline preview with the download URL when preview URL is missing', async () => {
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

		const preview = document.querySelector('[aria-label="Podgląd pliku photo.png"]');
		const image = preview?.querySelector('img[alt="photo.png"]') as HTMLImageElement | null;
		expect(preview).not.toBeNull();
		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(image?.src).toBe('https://example.com/photo.png?download=1');
	});
});
