import { redirect } from '@sveltejs/kit';

export function load({ url }: { url: URL }): never {
	redirect(308, `/${url.search}${url.hash}`);
}
