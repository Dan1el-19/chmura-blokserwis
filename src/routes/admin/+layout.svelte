<script lang="ts">
	import { page } from '$app/state';
	import { SquaresFour, Users } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/admin', label: 'Dashboard', icon: SquaresFour, exact: true },
		{ href: '/admin/users', label: 'Users', icon: Users, exact: false }
	];

	let currentPath = $derived(page.url.pathname);

	function isActive(tab: (typeof tabs)[0]) {
		if (tab.exact) return currentPath === tab.href;
		return currentPath.startsWith(tab.href);
	}
</script>

<div class="space-y-6">
	<header class="border-b border-border-line pb-4">
		<h1 class="text-2xl font-bold tracking-tight text-text-main">Admin Panel</h1>

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
		{@render children()}
	</main>
</div>
