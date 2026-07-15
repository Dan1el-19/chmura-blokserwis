import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('quotation navigation', () => {
	it('shows Wyceny to all authenticated roles and keeps nested routes active', () => {
		const layout = readFileSync(resolve(process.cwd(), 'src/routes/+layout.svelte'), 'utf8');
		const sidebar = readFileSync(
			resolve(process.cwd(), 'src/lib/components/layout/DesktopSidebar.svelte'),
			'utf8'
		);

		expect(layout).toContain("href: '/wyceny'");
		expect(layout).toContain("roles: ['basic', 'plus', 'admin']");
		expect(sidebar).toContain('currentPath.startsWith(`${item.href}/`)');
	});
});
