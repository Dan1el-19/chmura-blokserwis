import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

let component: ReturnType<typeof mount> | undefined;

afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	document.body.replaceChildren();
	vi.unstubAllGlobals();
});

describe('quotation creation errors', () => {
	it.each([
		{
			status: 400,
			body: { error: 'Nie można zapisać wyceny.', code: 'validation_error' },
			message: 'Nie można zapisać wyceny.'
		},
		{
			status: 400,
			body: { error: { message: 'Nie można zapisać wyceny.', code: 'validation_error' } },
			message: 'Nie można zapisać wyceny.'
		},
		{
			status: 400,
			body: { message: 'Nie można zapisać wyceny.' },
			message: 'Nie można zapisać wyceny.'
		},
		{
			status: 401,
			body: { error: 'Unauthorized' },
			message:
				'Sesja logowania jest nieaktywna. Zaloguj się ponownie w drugiej karcie, a następnie wróć tutaj i spróbuj ponownie. Wpisane dane pozostają w tym formularzu.'
		}
	])('shows the API error message for %j', async ({ status, body, message }) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })));
		component = mount(Page, { target: document.body });
		flushSync();
		const manualButton = [...document.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Wpisz ręcznie')
		)!;
		manualButton.click();
		flushSync();
		const row = document.querySelector('tbody tr')!;
		const fields = row.querySelectorAll('input');
		for (const [index, value] of [
			[0, 'Kamera'],
			[1, '1'],
			[2, 'szt.']
		] as const) {
			fields[index].value = value;
			fields[index].dispatchEvent(new Event('input', { bubbles: true }));
		}
		flushSync();
		const generateButton = [...document.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Wygeneruj wycenę')
		)!;
		expect(generateButton.disabled).toBe(false);
		generateButton.click();
		await vi.waitFor(async () => {
			await tick();
			expect(document.body.textContent).toContain(message);
		});
		expect(fields[0].value).toBe('Kamera');
		expect(fields[1].value).toBe('1');
		expect(fields[2].value).toBe('szt.');
	});
});
