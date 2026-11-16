import { create } from '@bufbuild/protobuf';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteScopeSectionSchema } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteAiProposal from './QuoteAiProposal.svelte';

it('shows both versions and protects a stale proposal', async () => {
 const apply=vi.fn(), dismiss=vi.fn();
 const current=[create(QuoteScopeSectionSchema,{heading:'Obecny',body:'Tekst ręczny'})];
 const proposal=[create(QuoteScopeSectionSchema,{heading:'Nowy',body:'Tekst AI'})];
 const view=await render(QuoteAiProposal,{current,proposal,stale:true,onapply:apply,ondismiss:dismiss});
 await expect.element(view.getByText('Tekst ręczny')).toBeVisible();
 await expect.element(view.getByText('Tekst AI')).toBeVisible();
 await expect.element(view.getByRole('button',{name:'Zastosuj zakres'})).toBeDisabled();
 await view.getByRole('button',{name:'Zostaw obecny'}).click();
 expect(dismiss).toHaveBeenCalledOnce(); expect(apply).not.toHaveBeenCalled();
});
