import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
	resolve(process.cwd(), 'src/lib/components/files/StoragePage.svelte'),
	'utf8'
);

describe('storage page breadcrumb UX', () => {
	it('keeps mobile breadcrumbs on one horizontal row', () => {
		expect(source).toContain('overflow-x-auto');
		expect(source).toContain('whitespace-nowrap');
		expect(source).toContain('leading-none');
		expect(source).toContain('inline-flex h-5 shrink-0 items-center');
	});

	it('builds folder breadcrumb links without duplicating query prefixes', () => {
		expect(source).toContain('function folderHref(folderId: string)');
		expect(source).toContain("if (rootHref === '?') return `?folder=${folderId}`;");
		expect(source).toContain('href={folderHref(crumb.id)}');
	});
});
