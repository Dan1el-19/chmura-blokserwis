import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { createUserUnisourceClient, requestUserUnisourceV2 } from '$lib/server/unisource';
import type { QuotationModelPrice } from '$lib/quotations/types';

async function optional<T>(request: Promise<T>): Promise<T | null> {
	try {
		return await request;
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(303, '/login');
	const client = await createUserUnisourceClient(event);
	const quotation = await client.quotations.get(event.params.id);
	const [letterheads, operations, versions, models] = await Promise.all([
		optional(client.quotations.listLetterheads()),
		optional(client.quotations.listAiOperations(event.params.id, { limit: 20 })),
		optional(client.quotations.listVersions(event.params.id)),
		optional(requestUserUnisourceV2<{ items: QuotationModelPrice[] }>(event, 'GET', '/v2/quotations/ai/models'))
	]);

	return {
		quotation,
		letterheads,
		operations,
		versions,
		models
	};
};
