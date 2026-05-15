import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/lib/components/files/FileList.svelte'),
	'utf8'
);

describe('mobile file list UX', () => {
	it('provides a three-dot contextual menu for mobile file rows', () => {
		expect(source).toContain('DotsThreeVertical');
		expect(source).toContain('openMenuId');
		expect(source).toContain('aria-label="Akcje dla {file.name}"');
	});

	it('prevents mobile long press selection from selecting file name text', () => {
		expect(source).toContain('select-none');
	});
});
