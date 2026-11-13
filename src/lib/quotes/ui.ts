import { Code, ConnectError } from '@connectrpc/connect';

export const button = 'rounded-md border border-border-line px-3 py-2 text-sm font-medium hover:bg-bg-app disabled:opacity-50';
export const primary = 'rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50';
export const field = 'w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm';
export const panel = 'space-y-4 rounded-lg border border-border-line bg-bg-panel p-4 sm:p-6';

export function formatQuoteLineValue(quantity: string, unitPrice: string): string {
	function parse(value: string): { amount: bigint; scale: bigint } | null {
		const match = /^([0-9]{1,12})(?:[.,]([0-9]{1,8}))?$/.exec(value);
		if (!match) return null;
		const fraction = match[2] ?? '';
		return { amount: BigInt(match[1] + fraction), scale: 10n ** BigInt(fraction.length) };
	}
	const count = parse(quantity);
	const price = parse(unitPrice);
	if (!count || count.amount === 0n || !price) return '—';
	const divisor = count.scale * price.scale;
	const grosze = (count.amount * price.amount * 100n + divisor / 2n) / divisor;
	return `${(grosze / 100n).toLocaleString('pl-PL')},${String(grosze % 100n).padStart(2, '0')} zł`;
}

export function quoteError(error: unknown): string {
	if (error instanceof ConnectError) {
		switch (error.code) {
			case Code.PermissionDenied: return 'Wybierz organizację Blokserwis w Clerk, aby otworzyć wyceny.';
			case Code.Aborted: return 'Szkic zmienił się w innym oknie lub podczas pracy w tle. Twoje zmiany pozostają w formularzu.';
			case Code.Unavailable: return 'Usługa wycen chwilowo nie odpowiada. Spróbuj ponownie.';
			default: return error.rawMessage;
		}
	}
	return error instanceof Error ? error.message : 'Operacja nie powiodła się.';
}

export function isMissing(error: unknown): boolean {
	return error instanceof ConnectError && error.code === Code.NotFound;
}

export function shouldPollQuote(statuses: Array<string | undefined>, statusReadFailed: boolean): boolean {
	return statusReadFailed || statuses.some((status) => status === 'queued' || status === 'running');
}
