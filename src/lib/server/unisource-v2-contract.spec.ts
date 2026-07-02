import { describe, expect, it } from 'vitest';
import { unwrapItem, unwrapList } from './unisource-v2-contract';

describe('UniSource V2 contract adapters', () => {
	it.each(['item', 'file', 'folder', 'service', 'user'] as const)(
		'unwraps the %s resource envelope',
		(key) => {
			const resource = { id: 'resource-1' };

			expect(unwrapItem({ [key]: resource })).toEqual(resource);
		}
	);

	it('normalizes a paginated list envelope', () => {
		expect(
			unwrapList({
				items: [{ id: 'file-1' }],
				page: { next_cursor: 'next-page', limit: 50 }
			})
		).toEqual({
			items: [{ id: 'file-1' }],
			nextCursor: 'next-page',
			limit: 50
		});
	});

	it('normalizes a compatible flat list envelope', () => {
		expect(
			unwrapList({
				items: [{ id: 'file-1' }],
				next_cursor: null,
				limit: 25
			})
		).toEqual({
			items: [{ id: 'file-1' }],
			nextCursor: null,
			limit: 25
		});
	});

	it('rejects an unknown item envelope', () => {
		expect(() => unwrapItem({ result: { id: 'file-1' } })).toThrow(
			'Unknown UniSource V2 resource envelope'
		);
	});

	it('rejects an unknown list envelope', () => {
		expect(() => unwrapList({ results: [] })).toThrow('Unknown UniSource V2 list envelope');
	});
});
