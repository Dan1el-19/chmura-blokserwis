<script lang="ts">
	import { page, navigating } from '$app/state';
	import { SquaresFour, Users, GearSix, ArrowsClockwise } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { createCrossRouteNavigationLoading } from '$lib/modules/navigation-loading.svelte';
	import RouteSkeleton from '$lib/components/ui/RouteSkeleton.svelte';

	let { children } = $props();

	const reloading = createCrossRouteNavigationLoading((from, to) => {
		const fromIsAdmin = from?.startsWith('/admin') ?? false;
		const toIsAdmin = to?.startsWith('/admin') ?? false;
		return fromIsAdmin && toIsAdmin;
	});

	const tabs = [
		{ href: '/admin', label: 'Pulpit', icon: SquaresFour, exact: true },
		{ href: '/admin/users', label: 'Użytkownicy', icon: Users, exact: false },
		{
			href: '/admin/storage-migrations',
			label: 'Migracje plików',
			icon: ArrowsClockwise,
			exact: false
		},
		{ href: '/admin/settings', label: 'Ustawienia', icon: GearSix, exact: false }
	];

	let currentPath = $derived(page.url.pathname);

	function isActive(tab: (typeof tabs)[0]) {
		if (tab.exact) return currentPath === tab.href;
		return currentPath.startsWith(tab.href);
	}
</script>

<div class="space-y-6">
	<header class="border-b border-border-line pb-4">
		<h1 class="text-2xl font-bold tracking-tight text-text-main">Admin</h1>

		<nav class="mt-4 flex gap-1">
			{#each tabs as tab}
				<a href={tab.href}>
					<Button variant={isActive(tab) ? 'secondary' : 'ghost'} size="sm" class="gap-2">
						<tab.icon class="h-4 w-4" />
						{tab.label}
					</Button>
				</a>
			{/each}
		</nav>
	</header>

	<main>
		{#if reloading.current}
			<RouteSkeleton routeId={navigating.to?.route?.id ?? null} />
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
