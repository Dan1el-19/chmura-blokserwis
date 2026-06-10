import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/lib/components/files/FileTable.svelte'),
	'utf8'
);
const appStyles = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

describe('desktop file table UX', () => {
	it('shows direct action buttons for desktop file and folder rows', () => {
		expect(source).not.toContain('DotsThreeVertical');
		expect(source).not.toContain('openMenuId');
		expect(source).not.toContain('aria-haspopup="menu"');
		expect(source).toContain('aria-label="Udostępnij {file.name}"');
		expect(source).toContain('aria-label="Pobierz {file.name}"');
		expect(source).toContain('aria-label="Zmień nazwę {file.name}"');
		expect(source).toContain('aria-label="Usuń {file.name}"');
		expect(source).toContain('aria-label="Zmień nazwę {folder.name}"');
		expect(source).toContain('aria-label="Usuń {folder.name}"');
	});
	it('keeps checkbox clicks from toggling selection twice', () => {
		const checkboxes = source.match(/<input[\s\S]*?type="checkbox"[\s\S]*?\/>/g) ?? [];

		expect(checkboxes).toHaveLength(3);
		for (const checkbox of checkboxes) {
			expect(checkbox).toContain('onclick={(e) => e.stopPropagation()}');
		}
	});

	it('uses the themed file selection checkbox style', () => {
		expect(source.match(/file-selection-checkbox/g)).toHaveLength(3);
		expect(appStyles).toContain('.file-selection-checkbox');
		expect(appStyles).toContain('appearance: none');
		expect(appStyles).toContain('background-color: var(--bg-panel)');
		expect(appStyles).toContain('.file-selection-checkbox:checked');
	});
});
