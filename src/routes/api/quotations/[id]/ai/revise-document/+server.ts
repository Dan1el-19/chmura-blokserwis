import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import {
	requestUserUnisourceV2,
	requestUserUnisourceV2Stream
} from '$lib/server/unisource';
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
		const idempotencyKey = quotationIdempotencyKey(event.request, body);
		if (event.request.headers.get('accept')?.includes('text/event-stream')) {
			const upstream = await requestUserUnisourceV2Stream(
				event,
				'POST',
				`/v2/quotations/${encodeURIComponent(event.params.id)}/ai/revise-document/stream`,
				{ body: withoutProxyFields(body), idempotencyKey }
			);
			return new Response(upstream.body, {
				status: upstream.status,
				headers: {
					'cache-control': upstream.headers.get('cache-control') ?? 'no-cache, no-transform',
					'content-type': upstream.headers.get('content-type') ?? 'text/event-stream; charset=utf-8'
				}
			});
		}
		return json(
			await requestUserUnisourceV2(event, 'POST', `/v2/quotations/${encodeURIComponent(event.params.id)}/ai/revise-document`, {
				body: withoutProxyFields(body),
				idempotencyKey
			})
		);
	} catch (error) {
		return quotationErrorResponse(error, 'Poprawianie wyceny nie powiodło się.');
	}
};
