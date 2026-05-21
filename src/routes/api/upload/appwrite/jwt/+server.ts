import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSessionClient } from '$lib/server/appwrite';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const { account } = createSessionClient(event);
	const { jwt } = await account.createJWT();
	return json({ jwt });
};
