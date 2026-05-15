import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readComponent(path: string) {
	return readFileSync(resolve(root, path), 'utf8');
}

describe('mobile file actions', () => {
	it('keeps simple two-action FAB with auto-upload on file action', () => {
		const source = readComponent('src/lib/components/upload/MobileStartUploadFAB.svelte');

		expect(source).toContain('onUpload: () => void');
		expect(source).toContain('onNewFolder?: () => void');
		expect(source).toContain("let isMenuOpen = $state(false)");
		expect(source).toContain('Nowy folder');
		expect(source).toContain('Prześlij pliki');
		expect(source).not.toContain("'root' | 'upload'");
		expect(source).not.toContain("'auto'");
		expect(source).not.toContain("'r2'");
		expect(source).not.toContain("'appwrite'");
	});

	it('keeps the mobile FAB transitions soft and reversible', () => {
		const source = readComponent('src/lib/components/upload/MobileStartUploadFAB.svelte');

		expect(source).toContain("import { fly, scale } from 'svelte/transition'");
		expect(source).toContain("import { backOut } from 'svelte/easing'");
		expect(source).toContain('y: 20, x: 10, duration: 250');
		expect(source).toContain('easing: backOut');
		expect(source).toContain('bg-black/20 backdrop-blur-sm');
		expect(source).toContain('transition:scale={{ duration: 200, start: 0.95 }}');
		expect(source).toContain('out:scale={{ duration: 150, start: 0.9 }}');
		expect(source).toContain('duration-300');
		expect(source).toContain('rotate-45');
		expect(source).toContain('rotate-0');
		expect(source).toContain('aria-expanded={isMenuOpen}');
		expect(source).not.toContain('linear');
		expect(source).not.toContain('cubic-bezier');
		expect(source).not.toContain('duration-[220ms]');
	});

	it('keeps desktop toolbar actions hidden on mobile while wiring FAB actions from the storage page', () => {
		const source = readComponent('src/lib/components/files/StoragePage.svelte');

		expect(source).toContain('class="hidden flex-wrap items-center gap-2 lg:flex"');
		expect(source).toContain('onMobileUpload={startUpload}');
		expect(source).toContain('onMobileNewFolder={() => (showCreateFolder = true)}');
	});
});
