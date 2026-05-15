import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/lib/components/files/FileTable.svelte'),
	'utf8'
);

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
});
