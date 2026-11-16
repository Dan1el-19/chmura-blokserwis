import { describe, expect, it } from 'vitest';
import { samePdfIdentity, readPdfResponse } from './pdf-preview.js';

describe('PDF preview identity', () => {
 it('includes the quote, version and template', () => {
  const a = {quoteId:'one', draftVersion:2n, revision:0n, templateVersion:'4'};
  expect(samePdfIdentity(a, {...a})).toBe(true);
  expect(samePdfIdentity(a, {...a,draftVersion:3n})).toBe(false);
  expect(samePdfIdentity(a, {...a,quoteId:'two'})).toBe(false);
  expect(samePdfIdentity(a, {...a,templateVersion:'5'})).toBe(false);
 });
 it('reads only a successful PDF within the limit', async () => {
  expect(new TextDecoder().decode(await readPdfResponse(new Response('%PDF-1.7', {status:200})))).toBe('%PDF-1.7');
  await expect(readPdfResponse(new Response('expired', {status:403}))).rejects.toThrow();
  await expect(readPdfResponse(new Response('x', {status:200,headers:{'content-length':String(21*1024*1024)}}))).rejects.toThrow();
 });
});
