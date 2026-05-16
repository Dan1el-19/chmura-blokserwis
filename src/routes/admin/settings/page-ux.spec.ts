import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/routes/admin/settings/+page.svelte'),
	'utf8'
);

describe('admin settings upload destination UX', () => {
	it('exposes all upload destinations supported by the SDK', () => {
		expect(source).toContain('value="r2"');
		expect(source).toContain('value="appwrite"');
		expect(source).toContain('value="hybrid"');
	});
});
