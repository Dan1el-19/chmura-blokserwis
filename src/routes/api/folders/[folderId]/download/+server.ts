import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ error: 'ZIP folder download is not supported in this version' }, { status: 410 });
};
