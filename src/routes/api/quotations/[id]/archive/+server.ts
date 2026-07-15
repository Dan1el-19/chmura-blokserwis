import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import {
	quotationErrorResponse,
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
		return json(await client.quotations.archive(event.params.id, withoutProxyFields(body)));
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się zarchiwizować wyceny.');
	}
};
