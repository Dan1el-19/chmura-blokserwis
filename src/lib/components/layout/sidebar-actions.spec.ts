import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function readComponent(path: string) {
	return readFileSync(resolve(root, path), 'utf8');
}

describe('sidebar action placement', () => {
	it('renders the trash nav item in the lower action section before logout on desktop', () => {
		const source = readComponent('src/lib/components/layout/DesktopSidebar.svelte');

		expect(source).toContain('const primaryNavItems');
		expect(source).toContain('const trashNavItem');
		expect(source.indexOf('{#if trashNavItem}')).toBeLessThan(
			source.indexOf('<form action="/logout"')
		);
	});

	it('renders the trash nav item before logout in the mobile drawer', () => {
		const source = readComponent('src/lib/components/layout/MobileDrawer.svelte');

		expect(source).toContain('const primaryNavItems');
		expect(source).toContain('const trashNavItem');
		expect(source).toContain('function itemDelay(index: number)');
		expect(source).toContain('const logoutIndex');
		expect(source.indexOf('{#if trashNavItem}')).toBeLessThan(source.indexOf('<!-- Logout -->'));
	});

	it('pins the mobile drawer to the viewport on horizontally wide pages', () => {
		const source = readComponent('src/lib/components/layout/MobileDrawer.svelte');

		expect(source).toContain('w-screen max-w-[100vw]');
		expect(source).toContain('overflow-x-hidden');
		expect(source).not.toContain('right-0 left-0');
		expect(source).toContain('class="flex w-full min-w-0 items-center gap-4');
		expect(source).toContain('method="POST" class="w-full"');
	});
});
