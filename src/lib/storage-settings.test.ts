import { expect, it } from 'vitest';
import { parseStorageAmount, formatStorageAmount } from './storage-settings.js';

it('converts decimal MB and GB inputs to exact integer bytes', () => {
	expect(parseStorageAmount('1.25', 'GB', 2_000_000_000n)).toBe(1_250_000_000n);
	expect(parseStorageAmount('0.001', 'MB', 2_000_000_000n)).toBe(1_000n);
});

it('rejects malformed, sub-byte, and over-capacity amounts', () => {
	expect(parseStorageAmount('1e3', 'MB', 2_000_000_000n)).toBeNull();
	expect(parseStorageAmount('0.0000001', 'MB', 2_000_000_000n)).toBeNull();
	expect(parseStorageAmount('2.1', 'GB', 2_000_000_000n)).toBeNull();
});

it('formats bigint bytes as decimal GB without converting through floating point', () => {
	expect(formatStorageAmount(1_250_000_000n, 'GB')).toBe('1.25');
});

it('preserves byte-precise limits when the settings form is saved unchanged', () => {
	expect(formatStorageAmount(1_000_000_001n, 'GB')).toBe('1.000000001');
	expect(parseStorageAmount(formatStorageAmount(1_000_000_001n, 'GB'), 'GB', 2_000_000_000n)).toBe(1_000_000_001n);
	expect(formatStorageAmount(1n, 'GB')).toBe('0.000000001');
	expect(formatStorageAmount(1n, 'MB')).toBe('0.000001');
});
