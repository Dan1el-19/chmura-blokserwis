import { expect, it } from 'vitest';
import { nextAvailableUploadName, uploadNameKey } from './upload-conflict.js';

it('chooses a free numbered name before the extension with canonical case-insensitive matching', () => {
	const occupied = new Set(['ŻÓŁĆ.txt', 'żółć (1).txt'].map(uploadNameKey));
	expect(nextAvailableUploadName('ŻÓŁĆ.txt', occupied)).toBe('ŻÓŁĆ (2).txt');
	expect(nextAvailableUploadName('.env', new Set([uploadNameKey('.env')]))).toBe('.env (1)');
});

it('keeps a long multibyte name inside the byte limit', () => {
	const name = 'ą'.repeat(124) + '.txt';
	const candidate = nextAvailableUploadName(name, new Set([uploadNameKey(name)]));
	expect(new TextEncoder().encode(candidate).length).toBeLessThanOrEqual(255);
	expect(candidate).toMatch(/ \(1\)\.txt$/);
});
