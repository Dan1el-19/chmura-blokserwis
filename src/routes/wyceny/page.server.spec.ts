import { beforeEach, describe, expect, it, vi } from 'vitest';

const { list, listLetterheads } = vi.hoisted(() => ({
	list: vi.fn(),
	listLetterheads: vi.fn()
}));

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: vi.fn(async () => ({
		quotations: { list, listLetterheads }
	}))
}));

import { load } from './+page.server';
import { load as loadNewQuotation } from './nowa/+page.server';

describe('/wyceny server load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		list.mockResolvedValue({ items: [], nextCursor: null, limit: 50 });
		listLetterheads.mockResolvedValue({
			items: [
				{ id: 'orange_axis', label: 'Orange Axis', description: '' },
				{ id: 'technical_grid', label: 'Technical Grid', description: '' },
				{ id: 'module_b', label: 'Module B', description: '' }
			],
			defaultVariant: 'orange_axis'
		});
	});

	it('loads persisted quotations with URL filters for an authenticated user', async () => {
		const result = await load({
			locals: { user: { $id: 'user-1' } },
			url: new URL('https://example.test/wyceny?search=Ilumino&status=draft')
		} as any);
		expect(result).toMatchObject({ persistence: 'server', quotations: { items: [] } });
		expect(list).toHaveBeenCalledWith(
			expect.objectContaining({ search: 'Ilumino', status: 'draft' })
		);
	});

	it('redirects an unauthenticated request to login', async () => {
		await expect(load({ locals: {} } as any)).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});

	it('loads letterheads on the authenticated new quotation route', async () => {
		expect(await loadNewQuotation({ locals: { user: { $id: 'user-1' } } } as any)).toMatchObject({
			persistence: 'server',
			letterheads: { defaultVariant: 'orange_axis' }
		});
		await expect(loadNewQuotation({ locals: {} } as any)).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
	});
});
