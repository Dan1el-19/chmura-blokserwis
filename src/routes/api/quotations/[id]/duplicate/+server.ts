import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import {
	quotationErrorResponse,
	quotationIdempotencyKey,
	readQuotationJson,
	requireQuotationUser,
	withoutProxyFields
} from '$lib/server/quotations';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	const body = await readQuotationJson(event.request);
	if (body instanceof Response) return body;
	try {
		const client = await createUserUnisourceClient(event);
		return json(
			await client.quotations.duplicate(event.params.id, withoutProxyFields(body), {
				idempotencyKey: quotationIdempotencyKey(event.request, body)
			})
		);
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się zduplikować wyceny.');
	}
};
