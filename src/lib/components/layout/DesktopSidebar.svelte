<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import UploadNavigation from './UploadNavigation.svelte';
	import type { UploadManager } from '#lib/upload-manager.svelte.js';
	import { SignOut } from 'phosphor-svelte';
	import { resolve } from '$app/paths';
	import type { Component } from 'svelte';
	import type { AppRoute, AppRouteWithQuery } from '#lib/routes.js';

	type NavItem = { href: AppRoute; label: string; icon: Component; color: string };
	let {
		navItems,
		currentPath,
		lastFolders = {},
		manager,
		onSignOut
	}: {
		lastFolders?: Record<string, string>;
		manager: UploadManager;
		navItems: NavItem[];
		currentPath: string;
		onSignOut: () => void;
	} = $props();
	const primaryNavItems = $derived(
		navItems.filter((item) => item.href !== '/trash' && item.href !== '/settings')
	);
	const secondaryNavItems = $derived(
		navItems.filter((item) => item.href === '/trash' || item.href === '/settings')
	);
</script>

<aside class="sticky top-0 hidden h-dvh w-65 shrink-0 flex-col border-r border-border-line bg-bg-panel lg:flex">
	<div class="flex h-16 items-center border-b border-border-line px-6">
		<a href={resolve('/')} class="flex items-center" aria-label="Chmura Blokserwis — strona główna">
			<img src={favicon} alt="" class="h-6 w-6" />
			<span class="ml-3 font-mono text-base font-bold tracking-tight whitespace-nowrap text-text-main">Chmura Blokserwis</span>
		</a>
	</div>

	<nav class="flex-1 space-y-1.5 overflow-y-auto p-5" aria-label="Nawigacja główna">
		{#each primaryNavItems as item (item.href)}
			<a
				href={resolve((lastFolders[item.href] ? `${item.href}?folder=${encodeURIComponent(lastFolders[item.href])}` : item.href) as AppRouteWithQuery)}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
					{currentPath === item.href || currentPath.startsWith(`${item.href}/`)
						? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
						: 'text-text-muted hover:bg-gray-50 hover:text-text-main dark:hover:bg-zinc-800'}"
			>
				<item.icon class="h-5 w-5" />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="space-y-1.5 border-t border-border-line p-4">
		<UploadNavigation {manager} />
		{#each secondaryNavItems as item (item.href)}
			<a
				href={resolve(item.href)}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
					{currentPath === item.href
						? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
						: 'text-text-muted hover:bg-gray-50 hover:text-text-main dark:hover:bg-zinc-800'}"
			>
				<item.icon class="h-5 w-5" />
				{item.label}
			</a>
		{/each}
		<button
			type="button"
			onclick={onSignOut}
			class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400"
		>
			<SignOut class="h-5 w-5" />
			Wyloguj
		</button>
	</div>
</aside>
