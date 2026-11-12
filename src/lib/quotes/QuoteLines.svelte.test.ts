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
	await expect.element(screen.getByLabelText('Nazwa pozycji 2')).toHaveValue('Druga');
	await screen.getByRole('button', { name: 'Usuń pozycję 1' }).click();
	await expect.element(screen.getByLabelText('Nazwa pozycji 1')).toHaveValue('Druga');
	await expect.element(screen.getByText(/Wiersz 9 w arkuszu/)).toBeVisible();
	await expect.element(screen.getByLabelText('Ilość pozycji 1')).toHaveValue('0.5');
	expect(onchange).toHaveBeenCalledTimes(1);
});
