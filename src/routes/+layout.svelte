<script lang="ts">
	import '../app.css';
	import { Toaster } from 'svelte-sonner';
	import { page, navigating } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { FileText, Folder, GearSix, Shield, RocketLaunch, Trash } from 'phosphor-svelte';
	import DesktopSidebar from '$lib/components/layout/DesktopSidebar.svelte';
	import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
	import MobileDrawer from '$lib/components/layout/MobileDrawer.svelte';
	import { createCrossRouteNavigationLoading } from '$lib/modules/navigation-loading.svelte';
	import RouteSkeleton from '$lib/components/ui/RouteSkeleton.svelte';

	let { children, data } = $props();
	let isDrawerOpen = $state(false);

	const reloading = createCrossRouteNavigationLoading((from, to) => {
		const fromIsAdmin = from?.startsWith('/admin') ?? false;
		const toIsAdmin = to?.startsWith('/admin') ?? false;
		return !(fromIsAdmin && toIsAdmin);
	});

	const allNavItems = [
		{
			href: '/',
			label: 'Pliki',
			icon: Folder,
			color: 'bg-blue-500',
			roles: ['basic', 'plus', 'admin']
		},
		{
			href: '/wyceny',
			label: 'Wyceny',
			icon: FileText,
			color: 'bg-cyan-600',
			roles: ['basic', 'plus', 'admin']
		},
		{
			href: '/trash',
			label: 'Kosz',
			icon: Trash,
			color: 'bg-red-500',
			roles: ['basic', 'plus', 'admin']
		},
		{
			href: '/main',
			label: 'Main',
			icon: Shield,
			color: 'bg-emerald-500',
			roles: ['plus', 'admin']
		},
		{
			href: '/releases',
			label: 'Releases',
			icon: RocketLaunch,
			color: 'bg-orange-500',
			roles: ['admin']
		},
		{ href: '/admin', label: 'Admin', icon: GearSix, color: 'bg-violet-500', roles: ['admin'] }
	];

	let navItems = $derived(
		allNavItems.filter((item) => data.role && item.roles.includes(data.role))
	);

	let currentPath = $derived(page.url.pathname);

	afterNavigate(() => {
		isDrawerOpen = false;
	});

	let pageTitle = $derived.by(() => {
		const path = currentPath;
		const navItem = allNavItems.find(
			(item) => item.href === path || (item.href !== '/' && path.startsWith(`${item.href}/`))
		);
		if (navItem) return `${navItem.label} | Chmura Blokserwis`;
		if (path.startsWith('/login')) return 'Logowanie | Chmura Blokserwis';
		if (path.startsWith('/admin/users')) {
			if (path.split('/').length > 3) return 'Szczegóły użytkownika | Chmura Blokserwis';
			return 'Użytkownicy | Chmura Blokserwis';
		}
		if (path.startsWith('/preview')) return 'Podgląd | Chmura Blokserwis';
		return 'Chmura Blokserwis';
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
</svelte:head>

<Toaster position="top-right" richColors theme="system" />

{#if currentPath.startsWith('/login') || currentPath.startsWith('/file/')}
	<!-- Minimal Layout (Login, Public Share) -->
	<main class="min-h-dvh bg-bg-app">
		{@render children()}
	</main>
{:else}
	<div class="flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
		<DesktopSidebar {navItems} {currentPath} />

		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<MobileHeader bind:isDrawerOpen />

			<MobileDrawer {navItems} {currentPath} bind:isDrawerOpen />

			<main class="flex-1 overflow-y-auto overscroll-none p-4 lg:p-10">
				{#if reloading.current}
					<RouteSkeleton routeId={navigating.to?.route?.id ?? null} />
				{:else}
					{@render children()}
				{/if}
			</main>
		</div>
	</div>
{/if}
