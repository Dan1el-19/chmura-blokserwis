import { describe, expect, it } from 'vitest';
import { getClerkJsBundleUrl, getClerkUiBundleUrl } from './clerk-ui.js';

describe('getClerkUiBundleUrl', () => {
	it('uses the Frontend API domain encoded in the Clerk publishable key', () => {
		expect(
			getClerkUiBundleUrl(
				'pk_test_b3JnYW5pYy1nb3NoYXdrLTg2LmNsZXJrLmFjY291bnRzLmRldiQ'
			)
		).toBe('https://organic-goshawk-86.clerk.accounts.dev/npm/@clerk/ui@1.41.0/dist/ui.browser.js');
	});

	it('supports the existing production Clerk Frontend API domain', () => {
		expect(
			getClerkUiBundleUrl('pk_live_Y2xlcmsuYXV0aC5ibG9rc2Vyd2lzLnBsJA')
		).toBe('https://clerk.auth.blokserwis.pl/npm/@clerk/ui@1.41.0/dist/ui.browser.js');
	});

	it('loads the matching Clerk JavaScript SDK from the Frontend API domain', () => {
		expect(
			getClerkJsBundleUrl(
				'pk_test_b3JnYW5pYy1nb3NoYXdrLTg2LmNsZXJrLmFjY291bnRzLmRldiQ'
			)
		).toBe('https://organic-goshawk-86.clerk.accounts.dev/npm/@clerk/clerk-js@6.40.0/dist/clerk.browser.js');
	});

	it('rejects a key that does not contain a valid Frontend API domain', () => {
		expect(() => getClerkUiBundleUrl('pk_test_invalid')).toThrow(
			'Nieprawidłowy klucz publikowalny Clerk.'
		);
	});
});
