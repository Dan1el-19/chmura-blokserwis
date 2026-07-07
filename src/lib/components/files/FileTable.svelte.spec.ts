import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionState } from '$lib/modules/selection.svelte';
import FileTable from './FileTable.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('FileTable checkbox interaction', () => {
	it('selects a file after clicking directly on its checkbox', async () => {
		const selection = new SelectionState();

		component = mount(FileTable, {
			target: document.body,
			props: {
				files: [
					{
						$id: 'file-1',
						name: 'raport.pdf',
						size: 1024,
						$createdAt: '2026-06-10T12:00:00.000Z'
					}
				],
				folders: [],
				selection,
				sortBy: 'name',
				sortDir: 'asc',
				onSort: () => {},
				onDownload: () => {},
				onPreview: () => {},
				onRename: () => {},
				onDelete: () => {},
				onNavigate: () => {},
				onShare: () => {}
			}
		});

		const checkbox = document.querySelector<HTMLInputElement>(
			'input[type="checkbox"][aria-label="Zaznacz raport.pdf"]'
		);
		expect(checkbox).not.toBeNull();

		checkbox?.click();
		flushSync();

		expect(checkbox?.checked).toBe(true);
		expect(selection.has('file-1')).toBe(true);
		expect(selection.count).toBe(1);
	});

	it('opens preview when clicking the file row', async () => {
		const selection = new SelectionState();
		const onPreview = vi.fn();
		const file = {
			$id: 'file-1',
			name: 'alarm.jpg',
			size: 1024,
			$createdAt: '2026-06-10T12:00:00.000Z',
			mimeType: 'image/jpeg'
		};

		component = mount(FileTable, {
			target: document.body,
			props: {
				files: [file],
				folders: [],
				selection,
				sortBy: 'name',
				sortDir: 'asc',
				onSort: () => {},
				onDownload: () => {},
				onPreview,
				onRename: () => {},
				onDelete: () => {},
				onNavigate: () => {},
				onShare: () => {}
			}
		});

		const row = document.querySelector<HTMLTableRowElement>('tr[aria-label="Plik alarm.jpg"]');
		expect(row).not.toBeNull();

		row?.click();
		flushSync();

		expect(onPreview).toHaveBeenCalledWith(file);
		expect(selection.has('file-1')).toBe(false);
	});
});
