import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import QuotationItemsEditor from './QuotationItemsEditor.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('QuotationItemsEditor', () => {
	it('allows every compact desktop control to shrink inside its grid track', () => {
		component = mount(QuotationItemsEditor, {
			target: document.body,
			props: {
				categories: [{ id: 'products', title: 'Produkty', sortOrder: 0 }],
				items: [
					{
						id: 'camera',
						name: 'Kamera',
						quantity: 2,
						unit: 'szt.',
						unitGrossCents: 12_345,
						totalGrossCents: 24_690,
						categoryId: 'products',
						sortOrder: 0
					}
				],
				onchange: vi.fn()
			}
		});

		for (const input of [
			document.querySelector('input[type="number"]'),
			...document.querySelectorAll('input[inputmode="decimal"]')
		]) {
			expect(input?.classList.contains('min-w-0')).toBe(true);
			expect(input?.classList.contains('w-full')).toBe(true);
			expect(input?.closest('label')?.classList.contains('min-w-0')).toBe(true);
		}
	});
});
