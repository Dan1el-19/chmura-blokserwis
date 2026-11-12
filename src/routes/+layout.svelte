<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onDestroy, setContext, tick, type Component } from 'svelte';
	import { CloudState, CLOUD_CONTEXT } from '#lib/cloud-state.svelte.js';
	import UploadPanel from '#lib/components/UploadPanel.svelte';
	import { page } from '$app/state';
	import { writable, readonly } from 'svelte/store';
	import { Folder, Shield, Trash, GearSix, FileText, ShareNetwork } from 'phosphor-svelte';
	import { Toaster } from 'svelte-sonner';
	import type { Clerk } from '@clerk/clerk-js';
	import { PUBLIC_CLERK_PUBLISHABLE_KEY, PUBLIC_QUOTES_API_URL } from '$app/env/public';
	import { loadClerk } from '#lib/clerk-ui.js';
	import { getClerkPendingSessionMessage, resolveClerkAuthState } from '#lib/clerk-auth-state.js';
	import { getPasskeyEnvironment, type PasskeyEnvironment } from '#lib/passkey-environment.js';
	import { setSessionTokenProvider } from '#lib/api.js';
	import { AUTH_CONTEXT, type AuthSnapshot } from '#lib/auth-context.js';
	import type { AppRoute } from '#lib/routes.js';
	import DesktopSidebar from '#lib/components/layout/DesktopSidebar.svelte';
	import MobileHeader from '#lib/components/layout/MobileHeader.svelte';
	import MobileDrawer from '#lib/components/layout/MobileDrawer.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	const cloud = new CloudState();
	setContext(CLOUD_CONTEXT, cloud);
	let scrollHost = $state<HTMLElement>();
	const authState = writable<AuthSnapshot>({ status: 'loading', user: null, error: null });
	let clerkInstance = $state.raw<Clerk>();
	let signInHost = $state<HTMLDivElement>();
	let mountedSignInHost: HTMLDivElement | undefined;
	let signInMounted = false;
	let clerkStarted = false;
	let disposed = false;
	let unsubscribe: (() => void) | undefined;
	let authRevision = 0;
	let verifiedSessionId = '';
	let refreshTimer: ReturnType<typeof setInterval> | undefined;
	let passkeyEnvironment = $state<PasskeyEnvironment>(null);
	let isDrawerOpen = $state(false);
	let menuButton = $state<HTMLButtonElement>();
	function handleMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isDrawerOpen) {
			isDrawerOpen = false;
			menuButton?.focus();
		}
	}
	let currentPath = $derived(page.url.pathname);
	const isPublicShare = $derived(currentPath === '/s' || currentPath.startsWith('/s/'));
	let pageTitle = $derived.by(() => {
		if (isPublicShare) return 'Chmura Blokserwis';
		if (currentPath === '/' || currentPath === '/main') return 'Pliki wspólne | Chmura Blokserwis';
		if (currentPath === '/personal') return 'Pliki prywatne | Chmura Blokserwis';
		if (currentPath === '/trash') return 'Kosz | Chmura Blokserwis';
		if (currentPath === '/shares') return 'Udostępnienia | Chmura Blokserwis';
		if (currentPath === '/wyceny' || currentPath.startsWith('/wyceny/')) return 'Wyceny | Chmura Blokserwis';
		if (currentPath === '/settings') return 'Ustawienia | Chmura Blokserwis';
		return 'Pliki | Chmura Blokserwis';
	});
	const navItems: Array<{ href: AppRoute; label: string; icon: Component; color: string }> = [
		{ href: '/', label: 'Pliki wspólne', icon: Folder, color: 'bg-blue-500' },
		{ href: '/personal', label: 'Pliki prywatne', icon: Shield, color: 'bg-emerald-500' },
		...(PUBLIC_QUOTES_API_URL ? [{ href: '/wyceny' as const, label: 'Wyceny', icon: FileText, color: 'bg-blue-500' }] : []),
		{ href: '/shares', label: 'Udostępnienia', icon: ShareNetwork, color: 'bg-indigo-500' },
		{ href: '/trash', label: 'Kosz', icon: Trash, color: 'bg-red-500' },
		{ href: '/settings', label: 'Ustawienia', icon: GearSix, color: 'bg-violet-500' }
	];

	function authErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : 'Nie udało się połączyć z Clerk.';
	}

	async function signOut(): Promise<void> {
		try {
			await clerkInstance?.signOut();
		} catch (error) {
			authState.update((state) => ({ ...state, error: authErrorMessage(error) }));
		}
	}

	setContext(AUTH_CONTEXT, {
		state: readonly(authState),
		signOut,
		selectOrganization: async (organization: string) => {
			if (!clerkInstance) throw new Error('Sesja Clerk jest niedostępna.');
			await clerkInstance.setActive({ organization });
		}
	});

	function startClerk(): void {
		if (clerkStarted || disposed) return;
		clerkStarted = true;
		refreshTimer = setInterval(() => {
			if (document.visibilityState === 'visible') cloud.revalidateActive();
		}, 60_000);
		passkeyEnvironment = getPasskeyEnvironment(
			window.isSecureContext,
			typeof window.PublicKeyCredential === 'function'
		);

		void (async () => {
			if (!PUBLIC_CLERK_PUBLISHABLE_KEY) {
				authState.set({
					status: 'error',
					user: null,
					error: 'Ustaw PUBLIC_CLERK_PUBLISHABLE_KEY w konfiguracji frontendu.'
				});
				return;
			}

			try {
				const clerk = await loadClerk(PUBLIC_CLERK_PUBLISHABLE_KEY);
				if (disposed) return;
				clerkInstance = clerk;
				setSessionTokenProvider(async (options) => clerk.session?.getToken(options) ?? null);

				const syncAuthentication = () => {
					const user = clerk.user ?? null;
					const session = clerk.session ?? null;
					const revision = ++authRevision;

					if (!user || !session) {
						verifiedSessionId = '';
						cloud.activate('');
						authState.set({ status: 'signed-out', user: null, error: null });
						return;
					}

					if (session.status === 'pending') {
						verifiedSessionId = '';
						cloud.activate('');
						authState.set({
							status: 'pending',
							user: null,
							error: getClerkPendingSessionMessage(session.currentTask?.key)
						});
						return;
					}

					if (session.status !== 'active') {
						verifiedSessionId = '';
						cloud.activate('');
						authState.set({ status: 'signed-out', user: null, error: null });
						return;
					}

					if (
						session.status === 'active' &&
						session.id === verifiedSessionId &&
						cloud.userId === user.id
					) {
						authState.set({ status: 'signed-in', user, error: null });
						return;
					}

					cloud.activate(user.id, session.id);
					authState.set({ status: 'loading', user: null, error: null });
					void resolveClerkAuthState(
						user,
						session,
						() =>
							!disposed &&
							authRevision === revision &&
							clerk.session?.id === session.id &&
							clerk.session?.status === session.status &&
							clerk.user?.id === user.id
					)
						.then((snapshot) => {
							if (!snapshot || disposed || authRevision !== revision) return;
							if (snapshot.status === 'signed-in') {
								verifiedSessionId = session.id;
								cloud.activate(user.id, session.id);
							}
							if (snapshot.status === 'signed-out' || snapshot.status === 'error') {
								verifiedSessionId = '';
								cloud.activate('');
							}
							authState.set(snapshot);
						})
						.catch((error: unknown) => {
							if (!disposed && authRevision === revision) {
								cloud.activate('');
								authState.set({ status: 'error', user: null, error: authErrorMessage(error) });
							}
						});
				};

				unsubscribe = clerk.addListener(syncAuthentication);
				syncAuthentication();
			} catch (error) {
				if (!disposed) {
					authState.set({ status: 'error', user: null, error: authErrorMessage(error) });
				}
			}
		})();

	}

	$effect(() => {
		if (!isPublicShare) startClerk();
	});

	onDestroy(() => {
		disposed = true;
		authRevision++;
		if (refreshTimer) clearInterval(refreshTimer);
		cloud.reset();
		unsubscribe?.();
		setSessionTokenProvider(async () => null);
		if (signInMounted && mountedSignInHost) clerkInstance?.unmountSignIn(mountedSignInHost);
		signInMounted = false;
		mountedSignInHost = undefined;
	});

	$effect(() => {
		if (!clerkInstance) return;
		const shouldMountSignIn = $authState.status === 'signed-out' || $authState.status === 'pending';
		if (shouldMountSignIn && signInHost && !signInMounted) {
			clerkInstance.mountSignIn(signInHost, {
				routing: 'hash',
				withSignUp: false,
				appearance: { variables: { colorPrimary: '#2d57b3', fontFamily: 'Inter, sans-serif' } }
			});
			signInMounted = true;
			mountedSignInHost = signInHost;
		} else if (!shouldMountSignIn && signInMounted && mountedSignInHost) {
			clerkInstance.unmountSignIn(mountedSignInHost);
			signInMounted = false;
			mountedSignInHost = undefined;
		}
	});

	$effect(() => {
		if (currentPath) isDrawerOpen = false;
	});
	$effect(() => {
		const key = cloud.activeListKey;
		const host = scrollHost;
		const list = cloud.activeList;
		if (!key || !host || !list) return;
		void tick().then(() => {
			if (cloud.activeListKey === key && cloud.activeList === list) host.scrollTop = list.scrollTop;
		});
	});
	function rememberScroll(): void {
		const list = cloud.activeList;
		if (!scrollHost || !list) return;
		list.scrollTop = scrollHost.scrollTop;
	}
	function guardUnload(event: BeforeUnloadEvent): void {
		if (cloud.transfers.pendingCount) {
			event.preventDefault();
			event.returnValue = '';
		}
	}
</script>

<svelte:window onbeforeunload={guardUnload} onfocus={()=>cloud.revalidateActive()} onkeydown={handleMenuKeydown} />
<svelte:document onvisibilitychange={()=>{if(document.visibilityState==='visible') cloud.revalidateActive();}} />

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
	<link rel="icon" href={favicon} />
</svelte:head>

{#if isPublicShare}
	{@render children()}
{:else}
	<Toaster position="top-right" richColors theme="system" />

{#if $authState.status === 'loading'}
	<main class="flex min-h-dvh items-center justify-center bg-bg-app p-4" aria-live="polite">
		<div class="flex items-center gap-3 rounded-lg border border-border-line bg-bg-panel px-5 py-4 text-sm text-text-muted">
			<span class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></span>
			Łączenie z bezpiecznym kontem…
		</div>
	</main>
{:else if $authState.status === 'error'}
	<main class="flex min-h-dvh items-center justify-center bg-bg-app p-4">
		<section class="w-full max-w-md rounded-lg border border-border-line bg-bg-panel p-6 shadow-lg" aria-labelledby="auth-error-title">
			<h1 id="auth-error-title" class="font-mono text-lg font-bold text-text-main">Nie udało się uruchomić logowania</h1>
			<p class="mt-3 text-sm text-text-muted">{$authState.error}</p>
			<button class="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" onclick={() => location.reload()}>Spróbuj ponownie</button>
		</section>
	</main>
{:else if $authState.status === 'signed-out' || $authState.status === 'pending'}
	<main class="flex min-h-dvh items-center justify-center bg-bg-app p-4">
		<section class="w-full max-w-md rounded-lg border border-border-line bg-bg-panel p-6 shadow-lg sm:p-8" aria-labelledby="sign-in-title">
			<div class="flex items-center gap-3">
				<img src={favicon} alt="" class="h-8 w-8" />
				<div>
					<p class="font-mono text-base font-bold text-text-main">Chmura Blokserwis</p>
					<p class="mt-0.5 text-xs text-text-muted">Wspólna przestrzeń plików</p>
				</div>
			</div>
			<h1 id="sign-in-title" class="mt-8 font-mono text-xl font-bold text-text-main">Zaloguj się</h1>
			{#if $authState.status === 'pending'}
				<p class="mt-2 text-sm leading-6 text-text-muted">{$authState.error} Zakończ wymagany krok, aby przejść do plików.</p>
			{:else}
				<p class="mt-2 text-sm leading-6 text-text-muted">Dostęp do chmury jest dostępny dla zaproszonych użytkowników.</p>
			{/if}
			{#if passkeyEnvironment === 'insecure'}
				<p class="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="status">
					Passkeys wymagają bezpiecznego połączenia HTTPS. Otwórz
					<a class="font-semibold underline" href="https://chmura.blokserwis.pl/">chmura.blokserwis.pl</a>.
				</p>
			{:else if passkeyEnvironment === 'unsupported'}
				<p class="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900" role="status">
					Ta przeglądarka nie udostępnia WebAuthn. Możesz zalogować się inną metodą.
				</p>
			{/if}
			<div class="mt-5 min-h-32" bind:this={signInHost}></div>
		</section>
	</main>
{:else}
	<div class="flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
		<DesktopSidebar {navItems} {currentPath} lastFolders={cloud.lastFolders} manager={cloud.transfers} onSignOut={signOut} />
		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<MobileHeader bind:isDrawerOpen bind:menuButton />
			<MobileDrawer {navItems} {currentPath} lastFolders={cloud.lastFolders} manager={cloud.transfers} bind:isDrawerOpen onSignOut={signOut} />
			<main bind:this={scrollHost} onscroll={rememberScroll} class="flex-1 overflow-y-auto overscroll-none p-4 pb-28 lg:p-10 lg:pb-28">
				{@render children()}
			</main>
			<UploadPanel manager={cloud.transfers} spaces={cloud.spaces} />
		</div>
	</div>
{/if}
{/if}
