<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/state';
	import { Folder, GearSix, Shield } from 'phosphor-svelte';
	import DesktopSidebar from '$lib/components/layout/DesktopSidebar.svelte';
	import MobileHeader from '$lib/components/layout/MobileHeader.svelte';
	import MobileDrawer from '$lib/components/layout/MobileDrawer.svelte';

	let { children, data } = $props();
	let isDrawerOpen = $state(false);

	const allNavItems = [
		{
			href: '/',
			label: 'Files',
			icon: Folder,
			color: 'bg-blue-500',
			roles: ['basic', 'plus', 'admin']
		},
		{
			href: '/main',
			label: 'Main Storage',
			icon: Shield,
			color: 'bg-emerald-500',
			roles: ['plus', 'admin']
		},
		{ href: '/admin', label: 'Admin', icon: GearSix, color: 'bg-violet-500', roles: ['admin'] }
	];

	let navItems = $derived(
		allNavItems.filter((item) => data.role && item.roles.includes(data.role))
	);

	let currentPath = $derived(page.url.pathname);

	$effect(() => {
		currentPath;
		isDrawerOpen = false;
	});

	let pageTitle = $derived.by(() => {
		const path = currentPath;
		const navItem = allNavItems.find((item) => item.href === path);
		if (navItem) return `${navItem.label} | Effinity Cloud`;
		if (path.startsWith('/login')) return 'Login | Effinity Cloud';
		if (path.startsWith('/admin/users')) {
			if (path.split('/').length > 3) return 'User Details | Effinity Cloud';
			return 'Users | Effinity Cloud';
		}
		if (path.startsWith('/preview')) return 'Preview | Effinity Cloud';
		return 'Effinity Cloud';
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
</svelte:head>

<Toaster position="top-right" richColors theme="system" />

{#if currentPath.startsWith('/login')}
	<!-- Login Layout (Minimal) -->
	<main class="min-h-dvh bg-bg-app">
		{@render children()}
	</main>
{:else}
	<div class="flex min-h-dvh flex-col lg:flex-row">
		<DesktopSidebar {navItems} {currentPath} />

		<div class="flex min-w-0 flex-1 flex-col">
			<MobileHeader bind:isDrawerOpen />

			<MobileDrawer {navItems} {currentPath} bind:isDrawerOpen />

			<main class="flex-1 overflow-y-auto overscroll-none p-4 lg:p-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
