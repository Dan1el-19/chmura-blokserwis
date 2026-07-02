export type NormalizedList<T> = {
	items: T[];
	nextCursor: string | null;
	limit: number;
};

const RESOURCE_KEYS = ['item', 'file', 'folder', 'service', 'user'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCursor(value: unknown): string | null {
	if (value === null || typeof value === 'string') {
		return value;
	}

	throw new Error('Invalid UniSource V2 pagination cursor');
}

function readLimit(value: unknown): number {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
		return value;
	}

	throw new Error('Invalid UniSource V2 pagination limit');
}

export function unwrapItem<T>(response: unknown): T {
	if (isRecord(response)) {
		for (const key of RESOURCE_KEYS) {
			if (key in response) {
				return response[key] as T;
			}
		}
	}

	throw new Error('Unknown UniSource V2 resource envelope');
}

export function unwrapList<T>(response: unknown): NormalizedList<T> {
	if (!isRecord(response) || !Array.isArray(response.items)) {
		throw new Error('Unknown UniSource V2 list envelope');
	}

	if (isRecord(response.page)) {
		return {
			items: response.items as T[],
			nextCursor: readCursor(response.page.next_cursor),
			limit: readLimit(response.page.limit)
		};
	}

	if ('next_cursor' in response && 'limit' in response) {
		return {
			items: response.items as T[],
			nextCursor: readCursor(response.next_cursor),
			limit: readLimit(response.limit)
		};
	}

	throw new Error('Unknown UniSource V2 list envelope');
}
