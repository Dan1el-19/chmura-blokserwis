import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { quotationErrorResponse, requireQuotationUser } from '$lib/server/quotations';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	try {
		const client = await createUserUnisourceClient(event);
		const month = event.url.searchParams.get('month') || undefined;
		const limit = Number(event.url.searchParams.get('limit') || 20);
		const [usage, operations] = await Promise.all([
			client.quotations.getAiUsage({ quotationId: event.params.id, month }),
			client.quotations.listAiOperations(event.params.id, {
				limit: Number.isInteger(limit) && limit >= 1 ? Math.min(limit, 100) : 20
			})
		]);
		return json({ usage, operations });
	} catch (error) {
		return quotationErrorResponse(error, 'Nie udało się pobrać kosztów AI.');
	}
};
