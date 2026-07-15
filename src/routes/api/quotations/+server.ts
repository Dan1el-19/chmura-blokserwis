import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import {
	normalizeCreateQuotation,
	parseQuotationListQuery,
	quotationErrorResponse,
	quotationIdempotencyKey,
	readQuotationJson,
	requireQuotationUser
} from '$lib/server/quotations';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	try {
		const client = await createUserUnisourceClient(event);
		return json(await client.quotations.list(parseQuotationListQuery(event.url)));
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się pobrać wycen.');
	}
};

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	const body = await readQuotationJson(event.request);
	if (body instanceof Response) return body;

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.quotations.create(normalizeCreateQuotation(body), {
			idempotencyKey: quotationIdempotencyKey(event.request, body)
		});
		return json(
			{ ...result, localDraftId: typeof body.localDraftId === 'string' ? body.localDraftId : null },
			{ status: 201 }
		);
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się utworzyć wyceny.');
	}
};
