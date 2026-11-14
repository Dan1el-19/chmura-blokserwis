import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';

test('udostępnia wyłącznie domenę Chmury w pliku WebAuthn', async () => {
	const response = await worker.fetch(new Request('https://auth.blokserwis.pl/.well-known/webauthn'));
	assert.equal(response.status, 200);
	assert.match(response.headers.get('content-type'), /^application\/json/);
	assert.deepEqual(await response.json(), { origins: ['https://chmura.blokserwis.pl'] });
});

test('kieruje stronę główną do Chmury bez przekazywania parametrów', async () => {
	const response = await worker.fetch(new Request('https://auth.blokserwis.pl/?example=private'));
	assert.equal(response.status, 302);
	assert.equal(response.headers.get('location'), 'https://chmura.blokserwis.pl/');
});

test('nie przekierowuje innych ścieżek', async () => {
	const response = await worker.fetch(new Request('https://auth.blokserwis.pl/other'));
	assert.equal(response.status, 404);
});
