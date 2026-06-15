import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
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
});
