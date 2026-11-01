import type { Clerk } from '@clerk/clerk-js';

const CLERK_UI_VERSION = '1.41.0';
const CLERK_JS_VERSION = '6.40.0';

let uiBundlePromise: Promise<void> | undefined;
let clerkJsPromise: Promise<void> | undefined;

function getFrontendApiDomain(publishableKey: string): string {
	const [prefix, environment, encodedFrontendApi] = publishableKey.split('_');
	if (prefix !== 'pk' || !['test', 'live'].includes(environment) || !encodedFrontendApi) {
		throw new Error('Nieprawidłowy klucz publikowalny Clerk.');
	}

	let frontendApi: string;
	try {
		frontendApi = atob(encodedFrontendApi).replace(/\$$/, '');
	} catch {
		throw new Error('Nieprawidłowy klucz publikowalny Clerk.');
	}

	if (!/^[a-z0-9.-]+$/i.test(frontendApi)) {
		throw new Error('Nieprawidłowy klucz publikowalny Clerk.');
	}

	return frontendApi;
}

export function getClerkUiBundleUrl(publishableKey: string): string {
	const frontendApi = getFrontendApiDomain(publishableKey);
	return `https://${frontendApi}/npm/@clerk/ui@${CLERK_UI_VERSION}/dist/ui.browser.js`;
}

export function getClerkJsBundleUrl(publishableKey: string): string {
	const frontendApi = getFrontendApiDomain(publishableKey);
	return `https://${frontendApi}/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`;
}

function appendClerkScript(src: string, publishableKey?: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.crossOrigin = 'anonymous';
		if (publishableKey) script.dataset.clerkPublishableKey = publishableKey;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error('Nie udało się załadować komponentów Clerk.'));
		document.head.appendChild(script);
	});
}

export async function loadClerk(publishableKey: string): Promise<Clerk> {
	if (typeof window === 'undefined') throw new Error('Komponenty Clerk wymagają przeglądarki.');

	if (!window.__internal_ClerkUICtor) {
		uiBundlePromise ??= appendClerkScript(getClerkUiBundleUrl(publishableKey)).catch((error: unknown) => {
			uiBundlePromise = undefined;
			throw error;
		});
		await uiBundlePromise;
	}

	if (!window.Clerk) {
		clerkJsPromise ??= appendClerkScript(getClerkJsBundleUrl(publishableKey), publishableKey).catch(
			(error: unknown) => {
				clerkJsPromise = undefined;
				throw error;
			}
		);
		await clerkJsPromise;
	}

	const ClerkUI = window.__internal_ClerkUICtor;
	const clerk = window.Clerk;
	if (!ClerkUI || !clerk) throw new Error('Serwis logowania nie zwrócił komponentów Clerk.');

	await clerk.load({ ui: { ClerkUI } });
	return clerk;
}
