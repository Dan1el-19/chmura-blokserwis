import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuoteWizard from './QuoteWizard.svelte';

const api = vi.hoisted(() => ({ createQuote: vi.fn(), getQuote: vi.fn() }));
const navigation = vi.hoisted(() => ({ goto: vi.fn(), beforeNavigate: vi.fn(), pushState: vi.fn(), replaceState: vi.fn() }));
vi.mock('#lib/api.js', () => ({ getQuoteClient: () => api }));
vi.mock('$app/navigation', () => navigation);
vi.mock('$app/paths', () => ({ resolve: (path: string, params?: {id: string}) => path.replace('[id]', params?.id ?? '') }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/wyceny/nowa'), state: {} } }));

beforeEach(() => { vi.resetAllMocks(); api.getQuote.mockResolvedValue({}); });

it('opens import selection without creating an empty draft', async () => {
	const view = await render(QuoteWizard, { id: 'nowa' });
	await expect.element(view.getByLabelText('Plik XLSX')).toBeVisible();
	expect(api.createQuote).not.toHaveBeenCalled();
	await view.getByText('Opcje zaawansowane').click();
	await expect.element(view.getByRole('button', { name: 'Wprowadź dane ręcznie' })).toBeVisible();
	expect(api.createQuote).not.toHaveBeenCalled();
});

it('creates a manual draft only on explicit selection and opens editing', async () => {
	api.createQuote.mockResolvedValue({ quote: { id: 'created-1' } });
	const view = await render(QuoteWizard, { id: 'nowa' });
	await view.getByText('Opcje zaawansowane').click();
	await view.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
	await expect.poll(() => navigation.goto.mock.calls[0]?.[0]).toBe('/wyceny/created-1?step=review&edit=1');
	expect(api.createQuote).toHaveBeenCalledTimes(1);
});

it('reuses the create key after an uncertain failure', async () => {
	api.createQuote.mockRejectedValueOnce(new Error('Brak połączenia')).mockResolvedValueOnce({ quote: { id: 'created-2' } });
	const view = await render(QuoteWizard, { id: 'nowa' });
	await view.getByText('Opcje zaawansowane').click();
	await view.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
	await expect.element(view.getByRole('alert')).toHaveTextContent('Brak połączenia');
	await view.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
	await expect.poll(() => api.createQuote.mock.calls.length).toBe(2);
	expect(api.createQuote.mock.calls[1][0].idempotencyKey).toBe(api.createQuote.mock.calls[0][0].idempotencyKey);
});


it('starts a fresh creation session after returning from an existing quote', async () => {
 api.createQuote.mockResolvedValueOnce({ quote: { id: 'first-quote' } }).mockResolvedValueOnce({ quote: { id: 'second-quote' } });
 const view = await render(QuoteWizard, { id: 'nowa' });
 await view.getByText('Opcje zaawansowane').click();
 await view.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
 await expect.poll(() => api.createQuote.mock.calls.length).toBe(1);
 await view.rerender({ id: 'first-quote' });
 await view.rerender({ id: 'nowa' });
 await view.getByText('Opcje zaawansowane').click();
 await view.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
 await expect.poll(() => api.createQuote.mock.calls.length).toBe(2);
 expect(api.createQuote.mock.calls[1][0].idempotencyKey).not.toBe(api.createQuote.mock.calls[0][0].idempotencyKey);
});
