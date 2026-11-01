import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'no-store, private',
		'X-Robots-Tag': 'noindex, nofollow, noarchive',
		'Referrer-Policy': 'no-referrer'
	});
	return {};
};
