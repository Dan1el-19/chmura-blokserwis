import { create } from '@bufbuild/protobuf';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteLineSchema } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteLines from './QuoteLines.svelte';

it('keeps source rows with their lines and numbers labels after removal', async () => {
	const onchange = vi.fn();
	const lines = $state([
		create(QuoteLineSchema, { name: 'Pierwsza', quantity: '1', unitPrice: '10' }),
		create(QuoteLineSchema, { name: 'Druga', quantity: '0.5', unitPrice: '20' })
	]);
	const screen = await render(QuoteLines, { lines, sourceRows: [4, 9], onchange });
	const table = screen.getByRole('table', { name: 'Pozycje wyceny' });
	(table.element().parentElement as HTMLElement).style.width = '700px';
	await expect.element(screen.getByLabelText('Nazwa pozycji 2')).toHaveValue('Druga');
	await screen.getByRole('button', { name: 'Usuń pozycję 1' }).click();
	await expect.element(screen.getByLabelText('Nazwa pozycji 1')).toHaveValue('Druga');
	await expect.element(screen.getByText(/Wiersz 9 w arkuszu/)).toBeVisible();
	await expect.element(screen.getByLabelText('Ilość pozycji 1')).toHaveValue('0.5');
	expect(onchange).toHaveBeenCalledTimes(1);
});

it('shows an exact line value while keeping the editable input strings', async () => {
	const lines = $state([create(QuoteLineSchema, { name: 'Kamera', quantity: '2.5', unitPrice: '19.99' })]);
	const screen = await render(QuoteLines, { lines, onchange: vi.fn() });
	const table = screen.getByRole('table', { name: 'Pozycje wyceny' });
	(table.element().parentElement as HTMLElement).style.width = '700px';
	await expect.element(table.getByText('49,98 zł', { exact: true })).toBeInTheDocument();
	await expect.element(table.getByLabelText('Ilość pozycji 1')).toHaveValue('2.5');
	await expect.element(table.getByLabelText('Cena brutto pozycji 1')).toHaveValue('19.99');
	await table.getByLabelText('Ilość pozycji 1').fill('');
	await expect.element(table.getByText('—', { exact: true })).toBeInTheDocument();
});

it('opens a compact mobile line for editing without losing its values', async () => {
	const lines = $state([create(QuoteLineSchema, { name: 'Czytnik kodów', quantity: '2', unitPrice: '19.99' })]);
	const screen = await render(QuoteLines, { lines, onchange: vi.fn() });
	const table = screen.getByRole('table', { name: 'Pozycje wyceny' });
	(table.element().parentElement as HTMLElement).style.width = '320px';
	const edit = screen.getByRole('button', { name: 'Edytuj pozycję 1: Czytnik kodów' });
	await expect.element(edit).toBeVisible();
	await expect.element(screen.getByLabelText('Ilość pozycji 1')).not.toBeVisible();
	await edit.click();
	await expect.element(screen.getByLabelText('Ilość pozycji 1')).toHaveValue('2');
	await screen.getByLabelText('Cena brutto pozycji 1').fill('25');
	await expect.element(table.getByText('50,00 zł').first()).toBeInTheDocument();
});

it('edits the optional line description', async () => {
	const onchange = vi.fn();
	const lines = $state([create(QuoteLineSchema, { name: 'Kamera', quantity: '1', unitPrice: '10' })]);
	const view = await render(QuoteLines, { lines, onchange });
	(view.getByRole('table', { name: 'Pozycje wyceny' }).element().parentElement as HTMLElement).style.width = '700px';
	await view.getByText('Opis pozycji').click();
	await view.getByLabelText('Opis pozycji 1').fill('Montaż na ścianie');
	expect(lines[0].description).toBe('Montaż na ścianie');
	expect(onchange).toHaveBeenCalled();
});

it('keeps descriptions collapsed until requested', async () => {
 const lines = $state([create(QuoteLineSchema, {name:'Zwora', quantity:'1', unitPrice:'330', description:'Zachowany opis'})]);
 const view = await render(QuoteLines, { lines, onchange:vi.fn() });
 (view.getByRole('table').element().parentElement as HTMLElement).style.width='800px';
 await expect.element(view.getByLabelText('Opis pozycji 1')).not.toBeVisible();
 await view.getByText('Opis pozycji').click();
 await expect.element(view.getByLabelText('Opis pozycji 1')).toHaveValue('Zachowany opis');
});

it('centers the totals and one-line actions on the editable fields at desktop widths', async () => {
	const lines = $state([
		create(QuoteLineSchema, { name: 'Zwora elektromagnetyczna i przycisk wyjścia', quantity: '1', unitPrice: '100' }),
		create(QuoteLineSchema, { name: 'Robocizna', quantity: '1', unitPrice: '30' })
	]);
	const view = await render(QuoteLines, { lines, sourceRows: [4, 5], onchange: vi.fn() });
	const table = view.getByRole('table').element();
	(table.parentElement as HTMLElement).style.width = '620px';
	const center = (rect: DOMRect) => (rect.top + rect.bottom) / 2;
	for (const [row, amount] of [[1, '100,00 zł'], [2, '30,00 zł']] as const) {
		const price = view.getByLabelText(`Cena brutto pozycji ${row}`).element();
		const total = view.getByText(amount, { exact: true }).last().element();
		const remove = view.getByRole('button', { name: `Usuń pozycję ${row}` }).element();
		const label = document.createRange();
		label.selectNodeContents(remove);
		expect(Array.from(label.getClientRects())).toHaveLength(1);
		expect(Math.abs(center(price.getBoundingClientRect()) - center(total.getBoundingClientRect()))).toBeLessThanOrEqual(1);
		expect(Math.abs(center(price.getBoundingClientRect()) - center(remove.getBoundingClientRect()))).toBeLessThanOrEqual(1);
	}
});
