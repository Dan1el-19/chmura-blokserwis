import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { quotationErrorResponse, requireQuotationUser } from '$lib/server/quotations';

const FILE_TYPES = {
	pdf: { mime: 'application/pdf', extension: 'pdf' },
	docx: {
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		extension: 'docx'
	}
} as const;

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireQuotationUser(event.locals);
	if (unauthorized) return unauthorized;
	const format = event.params.format as keyof typeof FILE_TYPES;
	if (!(format in FILE_TYPES))
		return json({ error: 'Nieobsługiwany format eksportu.' }, { status: 404 });

	try {
		const client = await createUserUnisourceClient(event);
		const { item } = await client.quotations.get(event.params.id);
		const useFinal = item.status === 'approved' && !item.hasPendingChanges;
		const bytes =
			format === 'pdf'
				? useFinal
					? await client.quotations.getFinalPdf(event.params.id)
					: await client.quotations.renderPdf(event.params.id, {
							expectedLockVersion: item.lockVersion
						})
				: useFinal
					? await client.quotations.getFinalDocx(event.params.id)
					: await client.quotations.renderDocx(event.params.id, {
							expectedLockVersion: item.lockVersion
						});
		const file = FILE_TYPES[format];
		const basename = safeFilename(
			item.document.number || item.document.title || `wycena-${item.id}`
		);
		return new Response(bytes, {
			headers: {
				'Content-Type': file.mime,
				'Content-Disposition': `attachment; filename="${basename}.${file.extension}"; filename*=UTF-8''${encodeURIComponent(`${basename}.${file.extension}`)}`,
				'Cache-Control': 'private, no-store',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch (error) {
		return quotationErrorResponse(error, 'Eksport wyceny nie powiódł się.');
	}
};

function safeFilename(value: string): string {
	return (
		value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[\\/:*?"<>|]+/g, '-')
			.replace(/\s+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 100) || 'wycena'
	);
}
