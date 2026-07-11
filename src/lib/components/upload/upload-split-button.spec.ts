import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
	fileURLToPath(new URL('./UploadSplitButton.svelte', import.meta.url)),
	'utf8'
);

describe('UploadSplitButton Fast Upload intent', () => {
	it('uses the dedicated Fast Upload pipeline while keeping manual R2 separate', () => {
		expect(source).toContain("onUpload('fast')");
		expect(source).toContain("handleOptionClick('r2')");
		expect(source).not.toContain("onUpload('auto')");
	});
});
