import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(303, '/login');
	const client = await createUserUnisourceClient(event);
	const letterheads = await client.quotations.listLetterheads();
	return { persistence: 'server' as const, letterheads };
};
