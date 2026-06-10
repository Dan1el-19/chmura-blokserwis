import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { SelectionState } from '$lib/modules/selection.svelte';
import FileTable from './FileTable.svelte';

describe('FileTable checkbox interaction', () => {
	it('selects a file after clicking directly on its checkbox', async () => {
		const selection = new SelectionState();

		render(FileTable, {
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

		const checkbox = page.getByRole('checkbox', { name: 'Zaznacz raport.pdf' });
		await checkbox.click();

		await expect.element(checkbox).toBeChecked();
		expect(selection.has('file-1')).toBe(true);
		expect(selection.count).toBe(1);
	});
});
