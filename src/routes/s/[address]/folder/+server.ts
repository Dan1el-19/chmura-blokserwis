import type { RequestHandler } from './$types';
import { privateResponseHeaders, publicError, shareApiHeaders, shareApiUrl, shareGrantCookieName } from '#lib/server/share-proxy.js';

export const prerender = false;
export const GET: RequestHandler = async ({params,cookies,fetch,url}) => {
	const address=params.address ?? '';
	const upstreamUrl=shareApiUrl(address,'/folder');
	for (const key of ['folder','pageToken']) {const value=url.searchParams.get(key); if (value) upstreamUrl.searchParams.set(key,value);}
	try {
		const response=await fetch(upstreamUrl,{cache:'no-store',headers:shareApiHeaders(cookies.get(shareGrantCookieName(address)))});
		return new Response(await response.text(),{status:response.status,headers:privateResponseHeaders('application/json; charset=utf-8')});
	} catch {return publicError(503);}
};
