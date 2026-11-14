export default {
	fetch(request) {
		const { pathname } = new URL(request.url);
		if (pathname === '/.well-known/webauthn') {
			return Response.json({ origins: ['https://chmura.blokserwis.pl'] });
		}
		if (pathname === '/') return Response.redirect('https://chmura.blokserwis.pl/', 302);
		return new Response('Not found', { status: 404 });
	}
};
