import { json } from '@sveltejs/kit';
import type { ApproveQuotationRequest } from '@unisource/sdk/v2';
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
		const input = {
			...withoutProxyFields(body),
			useAsAiExample: body.useAsAiExample !== false,
			saveVerifiedProductDescriptions: body.saveVerifiedProductDescriptions !== false
		} as unknown as ApproveQuotationRequest;
		return json(
			await client.quotations.approve(event.params.id, input, {
				idempotencyKey: quotationIdempotencyKey(event.request, body)
			})
		);
	} catch (error) {
		return quotationErrorResponse(error, 'Zatwierdzenie wyceny nie powiodło się.');
	}
};
