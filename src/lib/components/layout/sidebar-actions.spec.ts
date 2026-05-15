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
});
