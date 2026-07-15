import { json } from '@sveltejs/kit';
import type { UpdateQuotationRequest } from '@unisource/sdk/v2';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import {
	quotationErrorResponse,
	readQuotationJson,
	requireQuotationUser,
	withoutProxyFields
} from '$lib/server/quotations';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	try {
		const client = await createUserUnisourceClient(event);
		return json(await client.quotations.get(event.params.id));
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się pobrać wyceny.');
	}
};

export const PATCH: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	const body = await readQuotationJson(event.request);
	if (body instanceof Response) return body;
	if (!Number.isInteger(body.expectedLockVersion) || Number(body.expectedLockVersion) < 0) {
		return json({ error: 'Brak poprawnej wersji blokady wyceny.' }, { status: 400 });
	}

	try {
		const client = await createUserUnisourceClient(event);
		return json(
			await client.quotations.update(
				event.params.id,
				withoutProxyFields(body) as unknown as UpdateQuotationRequest
			)
		);
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się zapisać wyceny.');
	}
};
