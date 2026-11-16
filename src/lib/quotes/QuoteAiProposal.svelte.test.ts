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

it('compares line names and descriptions before applying the full proposal', async () => {
 const view=await render(QuoteAiProposal,{current:[],proposal:[],stale:false,onapply:vi.fn(),ondismiss:vi.fn(),
  lines:[{name:'zwora 600 sl',description:''}],
  proposedLines:[{lineIndex:0,name:'Zwora elektromagnetyczna 600 SL',description:'Utrzymuje drzwi zamknięte.'}]});
 await expect.element(view.getByText('Zwora elektromagnetyczna 600 SL')).toBeVisible();
 await expect.element(view.getByText('Utrzymuje drzwi zamknięte.')).toBeVisible();
 await expect.element(view.getByRole('button',{name:'Zastosuj propozycję'})).toBeEnabled();
});
