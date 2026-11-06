import { Code, ConnectError } from '@connectrpc/connect';

export const button = 'rounded-md border border-border-line px-3 py-2 text-sm font-medium hover:bg-bg-app disabled:opacity-50';
export const primary = 'rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50';
export const field = 'w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm';
export const panel = 'space-y-4 rounded-lg border border-border-line bg-bg-panel p-4 sm:p-6';

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
