import { create } from '@bufbuild/protobuf';
import { expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { GetQuoteOperationResponseSchema } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteAiActivity from './QuoteAiActivity.svelte';

it('shows recovered searches, their sources and the provisional streaming text', async () => {
	const operation = create(GetQuoteOperationResponseSchema, {
		status: 'running', researchStatus: 'completed', partialJson: '{"introduction":"Dzień dobry',
		searches: [{ item: 'Kamera DS-123', status: 'completed', sources: [{ title: 'Karta produktu', url: 'https://example.com/karta' }] }]
	});
	const view = await render(QuoteAiActivity, { operation });
	await expect.element(view.getByText('Kamera DS-123')).toBeVisible();
	await expect.element(view.getByText('Dzień dobry')).toBeVisible();
	await view.getByText('Źródła internetowe (1)').click();
	await expect.element(view.getByRole('link', { name: 'Karta produktu' })).toHaveAttribute('href', 'https://example.com/karta');
});

it('collapses completed research while keeping its sources available', async () => {
	const operation = create(GetQuoteOperationResponseSchema, {
		status: 'succeeded', researchStatus: 'completed',
		searches: [{ item: 'Kamera DS-123', status: 'completed', sources: [{ title: 'Karta produktu', url: 'https://example.com/karta' }] }]
	});
	const view = await render(QuoteAiActivity, { operation });
	await expect.element(view.getByText('Opis jest gotowy')).toBeVisible();
	await expect.element(view.getByText('Kamera DS-123')).not.toBeVisible();
	await view.getByText('Szczegóły aktywności').click();
	await expect.element(view.getByText('Kamera DS-123')).toBeVisible();
	await view.getByText('Źródła internetowe (1)').click();
	await expect.element(view.getByRole('link', { name: 'Karta produktu' })).toBeVisible();
});
