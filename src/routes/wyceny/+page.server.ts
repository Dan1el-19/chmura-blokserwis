import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { parseQuotationListQuery } from '$lib/server/quotations';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(303, '/login');

	const client = await createUserUnisourceClient(event);
	const query = parseQuotationListQuery(event.url);
	const quotations = await client.quotations.list(query);

	return { persistence: 'server' as const, quotations, filters: query };
};

async function quotationAction(
	event: Parameters<NonNullable<Actions[string]>>[0],
	action: 'duplicate' | 'archive' | 'restore'
) {
	if (!event.locals.user) throw redirect(303, '/login');
	const form = await event.request.formData();
	const id = String(form.get('id') ?? '').trim();
	const rawLockVersion = form.get('lockVersion');
	const lockVersion =
		rawLockVersion === null || rawLockVersion === '' ? undefined : Number(rawLockVersion);
	if (!id || (lockVersion !== undefined && !Number.isInteger(lockVersion))) {
		return fail(400, { action, error: 'Nieprawidłowe dane wyceny.' });
	}

	try {
		const client = await createUserUnisourceClient(event);
		const body = lockVersion === undefined ? {} : { expectedLockVersion: lockVersion };
		const result =
			action === 'duplicate'
				? await client.quotations.duplicate(id, body, { idempotencyKey: crypto.randomUUID() })
				: await client.quotations[action](id, body);
		return { action, success: true, item: result.item };
	} catch (error) {
		const status =
			typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
		return fail(status >= 400 && status < 600 ? status : 500, {
			action,
			error: error instanceof Error ? error.message : 'Operacja na wycenie nie powiodła się.'
		});
	}
}

export const actions: Actions = {
	duplicate: (event) => quotationAction(event, 'duplicate'),
	archive: (event) => quotationAction(event, 'archive'),
	restore: (event) => quotationAction(event, 'restore')
};
