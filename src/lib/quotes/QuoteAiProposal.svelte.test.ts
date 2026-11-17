import { create } from '@bufbuild/protobuf';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteScopeSectionSchema } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteAiProposal from './QuoteAiProposal.svelte';

it('shows the new description first and protects a stale proposal', async () => {
 const apply=vi.fn(), dismiss=vi.fn();
 const current=[create(QuoteScopeSectionSchema,{heading:'Obecny',body:'Tekst ręczny'})];
 const proposal=[create(QuoteScopeSectionSchema,{heading:'Nowy',body:'Tekst AI'})];
 const view=await render(QuoteAiProposal,{current,proposal,stale:true,onapply:apply,ondismiss:dismiss});
 await expect.element(view.getByText('Tekst AI')).toBeVisible();
 await expect.element(view.getByText('Tekst ręczny')).not.toBeVisible();
 await view.getByText('Porównaj z obecnym tekstem').click();
 await expect.element(view.getByText('Tekst ręczny')).toBeVisible();
 await expect.element(view.getByRole('button',{name:'Zastosuj propozycję'})).toBeDisabled();
 await view.getByRole('button',{name:'Zostaw obecny'}).click();
 expect(dismiss).toHaveBeenCalledOnce(); expect(apply).not.toHaveBeenCalled();
});

it('discloses only actual name changes and hides old per-line descriptions', async () => {
 const view=await render(QuoteAiProposal,{current:[],proposal:[],stale:false,onapply:vi.fn(),ondismiss:vi.fn(),
  lines:[{name:'zwora 600 sl',description:''},{name:'Przewód',description:'Dawny opis'}],
  proposedLines:[{lineIndex:0,name:'Zwora elektromagnetyczna 600 SL',description:'Utrzymuje drzwi zamknięte.'},{lineIndex:1,name:'Przewód',description:''}]});
 await expect.element(view.getByText('Zwora elektromagnetyczna 600 SL')).not.toBeVisible();
 await view.getByText('Zmiany nazw pozycji').click();
 await expect.element(view.getByText('Zwora elektromagnetyczna 600 SL')).toBeVisible();
 await expect.element(view.getByText('zwora 600 sl',{exact:true})).toBeVisible();
 await expect.element(view.getByText('Utrzymuje drzwi zamknięte.')).not.toBeInTheDocument();
 await expect.element(view.getByText('Przewód')).not.toBeInTheDocument();
 await expect.element(view.getByRole('button',{name:'Zastosuj propozycję'})).toBeEnabled();
});
