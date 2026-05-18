import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/lib/components/files/ShareDialog.svelte'),
	'utf8'
);

describe('share dialog link settings UX', () => {
	it('lets users edit existing link settings instead of only deleting links', () => {
		expect(source).toContain('handleEditStart');
		expect(source).toContain('handleUpdate');
		expect(source).toContain("method: 'PATCH'");
		expect(source).toContain('Edytuj ustawienia linku');
	});
});
