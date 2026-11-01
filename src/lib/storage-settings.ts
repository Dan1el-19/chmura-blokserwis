export type StorageUnit = 'MB' | 'GB';

const BYTES_PER_UNIT: Record<StorageUnit, bigint> = {
	MB: 1_000_000n,
	GB: 1_000_000_000n
};

export function parseStorageAmount(value: string, unit: StorageUnit, maximumBytes: bigint): bigint | null {
	const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value.trim());
	if (!match) return null;
	const whole = BigInt(match[1]!);
	const fraction = match[2] ?? '';
	const denominator = 10n ** BigInt(fraction.length);
	const scaled = whole * denominator + BigInt(fraction || '0');
	const numerator = scaled * BYTES_PER_UNIT[unit];
	if (numerator % denominator !== 0n) return null;
	const bytes = numerator / denominator;
	return bytes <= maximumBytes ? bytes : null;
}

export function formatStorageAmount(bytes: bigint, unit: StorageUnit): string {
	const unitBytes = BYTES_PER_UNIT[unit];
	const whole = bytes / unitBytes;
	const fractional = bytes % unitBytes;
	const fractionDigits = unitBytes.toString().length - 1;
	const fractionText = fractional.toString().padStart(fractionDigits, '0').replace(/0+$/, '');
	return fractionText ? `${whole}.${fractionText}` : whole.toString();
}
