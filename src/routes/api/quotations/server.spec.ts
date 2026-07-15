import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, renderHtml } = vi.hoisted(() => ({
	create: vi.fn(),
	renderHtml: vi.fn()
}));

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: vi.fn(async () => ({ quotations: { create, renderHtml } }))
}));

import { POST as createQuotation } from './+server';
import { GET as previewQuotation } from './[id]/preview/+server';

describe('/api/quotations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		create.mockResolvedValue({ item: { id: 'quotation-1' } });
		renderHtml.mockResolvedValue('<!doctype html><html><body>Wycena</body></html>');
	});

	it('migrates a local draft through the SDK and preserves its confirmation id', async () => {
		const request = new Request('https://example.test/api/quotations', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'Idempotency-Key': 'local-local-1' },
			body: JSON.stringify({
				localDraftId: 'local-1',
				localDraft: { title: 'Lokalna wycena', items: [] }
			})
		});
		const response = await createQuotation({ locals: { user: { $id: 'user-1' } }, request } as any);

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			item: { id: 'quotation-1' },
			localDraftId: 'local-1'
		});
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Lokalna wycena' }), {
			idempotencyKey: 'local-local-1'
		});
	});

	it('returns a same-origin, non-cacheable HTML preview', async () => {
		const response = await previewQuotation({
			locals: { user: { $id: 'user-1' } },
			params: { id: 'quotation-1' }
		} as any);

		expect(response.headers.get('content-type')).toContain('text/html');
		expect(response.headers.get('cache-control')).toContain('no-store');
		expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
		expect(await response.text()).toContain('Wycena');
	});

	it('rejects unauthenticated creation before calling UniSource', async () => {
		const response = await createQuotation({
			locals: {},
			request: new Request('https://example.test')
		} as any);
		expect(response.status).toBe(401);
		expect(create).not.toHaveBeenCalled();
	});
});
