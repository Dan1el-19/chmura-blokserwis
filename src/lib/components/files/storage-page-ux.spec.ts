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

	it('keeps Fast Upload primary and New Folder secondary in the desktop toolbar', () => {
		const fastUploadIndex = source.indexOf('<UploadSplitButton onUpload={startUpload} />');
		const newFolderIndex = source.indexOf('<span>Nowy folder</span>');

		expect(fastUploadIndex).toBeGreaterThan(-1);
		expect(newFolderIndex).toBeGreaterThan(fastUploadIndex);
		expect(source).toContain(
			'h-10 items-center gap-1.5 rounded-lg border border-border-line bg-transparent'
		);
		expect(source).toContain('focus-visible:ring-2 focus-visible:ring-primary/50');
	});
});
