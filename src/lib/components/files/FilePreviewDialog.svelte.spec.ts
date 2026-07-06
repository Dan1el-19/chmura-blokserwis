import { mount, unmount, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FilePreviewDialog from './FilePreviewDialog.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('FilePreviewDialog', () => {
	const previewProps = {
		open: true,
		file: { id: 'file-1', name: 'photo.png', mimeType: 'image/png', size: 100 },
		preview: {
			previewUrl: 'https://example.com/photo.png',
			downloadUrl: 'https://example.com/photo.png?download=1',
			expiresAt: 1760000000,
			contentType: 'image/png'
		},
		loading: false,
		error: null,
		onClose: () => {},
		onRetry: () => {}
	};

	it('renders image preview when previewUrl is available', async () => {
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: previewProps
		});
		flushSync();

		const dialog = document.querySelector('[role="dialog"][aria-label="photo.png"]');
		expect(dialog).not.toBeNull();

		const image = document.querySelector('img[alt="photo.png"]') as HTMLImageElement | null;
		expect(image).not.toBeNull();
		expect(image?.src).toBe('https://example.com/photo.png');
	});

	it('closes when clicking the backdrop', () => {
		const onClose = vi.fn();
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: {
				...previewProps,
				onClose
			}
		});
		flushSync();

		document.querySelector<HTMLElement>('[role="dialog"]')?.click();

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close when clicking inside the dialog panel', () => {
		const onClose = vi.fn();
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: {
				...previewProps,
				onClose
			}
		});
		flushSync();

		document.querySelector<HTMLElement>('h2')?.click();

		expect(onClose).not.toHaveBeenCalled();
	});

	it('closes on Escape even when focus is inside the dialog', () => {
		const onClose = vi.fn();
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: {
				...previewProps,
				onClose
			}
		});
		flushSync();

		const closeButton = document.querySelector<HTMLButtonElement>(
			'button[aria-label="Zamknij podglad"]'
		);
		closeButton?.focus();
		closeButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close on Escape when the dialog is closed', () => {
		const onClose = vi.fn();
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: {
				...previewProps,
				open: false,
				onClose
			}
		});
		flushSync();

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(onClose).not.toHaveBeenCalled();
	});

	it('shows unsupported message for non-media files', async () => {
		component = mount(FilePreviewDialog, {
			target: document.body,
			props: {
				open: true,
				file: { id: 'file-2', name: 'archive.zip', mimeType: 'application/zip', size: 100 },
				preview: {
					previewUrl: 'https://example.com/archive.zip',
					downloadUrl: 'https://example.com/archive.zip?download=1',
					expiresAt: 1760000000,
					contentType: 'application/zip'
				},
				loading: false,
				error: null,
				onClose: () => {},
				onRetry: () => {}
			}
		});
		flushSync();

		expect(document.body.textContent).toContain('podgląd nie jest dostępny dla tego formatu');
	});
});
