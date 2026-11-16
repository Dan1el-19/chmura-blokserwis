import { expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QuotePdfPreview from './QuotePdfPreview.svelte';

function pdfFixture(): Uint8Array {
 const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>','<< /Length 44 >>\nstream\nBT /F1 18 Tf 40 750 Td (Hello PDF) Tj ET\nendstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let source='%PDF-1.4\n'; const offsets=[0];
 objects.forEach((object,i) => { offsets.push(source.length); source += `${i+1} 0 obj\n${object}\nendobj\n`; });
 const xref=source.length; source += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 source += offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('');
 source += `trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new TextEncoder().encode(source);
}

it('renders a PDF page with selectable text and zoom controls', async () => {
 const view = await render(QuotePdfPreview, {bytes:pdfFixture()});
 await expect.element(view.getByText(/Liczba stron: 1/)).toBeVisible();
 await expect.poll(() => view.container.querySelector('.textLayer')?.textContent).toContain('Hello PDF');
 const canvas = view.container.querySelector('canvas');
 expect(canvas?.width).toBeGreaterThan(0);
 await view.getByRole('button',{name:'100%'}).click();
 await expect.element(view.getByText(/100%/).last()).toBeVisible();
});

it('acknowledges only a successfully rendered document and reports invalid PDFs',async()=>{
 const loaded=vi.fn(),failed=vi.fn();
 const view=await render(QuotePdfPreview,{bytes:pdfFixture(),onloaded:loaded,onerror:failed});
 await expect.poll(()=>loaded.mock.calls.length).toBeGreaterThan(0);
 expect(failed).not.toHaveBeenCalled();
 await view.rerender({bytes:new TextEncoder().encode('%PDF-invalid'),onloaded:loaded,onerror:failed});
 await expect.poll(()=>failed.mock.calls.length).toBeGreaterThan(0);
});
