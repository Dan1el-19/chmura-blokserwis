import { create } from '@bufbuild/protobuf';
import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteScopeSectionSchema } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteScopeEditor from './QuoteScopeEditor.svelte';

it('edits, reorders and removes scope sections', async () => {
 const onchange = vi.fn();
 const sections = $state([create(QuoteScopeSectionSchema,{heading:'Pierwsza',body:'Tekst 1'}),create(QuoteScopeSectionSchema,{heading:'Druga',body:'Tekst 2'})]);
 const view = await render(QuoteScopeEditor,{sections,onchange});
 await view.getByRole('button',{name:'Przenieś podsekcję 2 w górę'}).click();
 await expect.element(view.getByLabelText('Nagłówek podsekcji 1')).toHaveValue('Druga');
 await view.getByLabelText('Treść podsekcji 1').fill('Nowa treść');
 await view.getByRole('button',{name:'Usuń podsekcję 2'}).click();
 await view.getByRole('button',{name:'Dodaj podsekcję'}).click();
 await expect.element(view.getByLabelText('Nagłówek podsekcji 2')).toHaveValue('');
 expect(onchange).toHaveBeenCalled();
});
