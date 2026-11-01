import { describe, expect, it } from 'vitest';
import { getPasskeyEnvironment } from './passkey-environment.js';

describe('getPasskeyEnvironment', () => {
	it('directs users to the HTTPS application when the current origin is insecure', () => {
		expect(getPasskeyEnvironment(false, true)).toBe('insecure');
	});

	it('reports browsers without WebAuthn support', () => {
		expect(getPasskeyEnvironment(true, false)).toBe('unsupported');
	});

	it('returns no warning when secure WebAuthn is available', () => {
		expect(getPasskeyEnvironment(true, true)).toBeNull();
	});
});
