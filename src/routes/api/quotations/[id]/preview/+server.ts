import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { quotationErrorResponse, requireQuotationUser } from '$lib/server/quotations';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	try {
		const client = await createUserUnisourceClient(event);
		const html = await client.quotations.renderHtml(event.params.id);
		return new Response(html, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'private, no-store, max-age=0',
				Pragma: 'no-cache',
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'SAMEORIGIN',
				'Content-Security-Policy':
					"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"
			}
		});
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się wyrenderować podglądu wyceny.');
	}
};
