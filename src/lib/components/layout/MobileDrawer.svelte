<script lang="ts">
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
		onSignOut,
		isDrawerOpen = $bindable()
	}: {
		lastFolders?: Record<string, string>;
		manager: UploadManager;
		navItems: NavItem[];
		currentPath: string;
		onSignOut: () => void;
		isDrawerOpen: boolean;
	} = $props();
	const primaryNavItems = $derived(navItems.filter((item) => item.href !== '/trash' && item.href !== '/settings'));
	const secondaryNavItems = $derived(navItems.filter((item) => item.href === '/trash' || item.href === '/settings'));

	function isActive(item: NavItem) {
		return currentPath === item.href || (item.href !== '/' && currentPath.startsWith(`${item.href}/`));
	}
</script>

{#if isDrawerOpen}
	<button type="button" class="fixed inset-0 z-20 mt-14 bg-black/40 lg:hidden" onclick={() => (isDrawerOpen = false)} aria-label="Zamknij menu"></button>
	<nav class="fixed top-14 left-0 z-30 flex max-h-[calc(100dvh-3.5rem)] w-full flex-col gap-1 overflow-y-auto border-b border-border-line bg-bg-panel p-4 shadow-lg lg:hidden" aria-label="Nawigacja mobilna">
		{#each primaryNavItems as item (item.href)}
			<a
				aria-current={isActive(item) ? 'page' : undefined}
				href={resolve((lastFolders[item.href] ? `${item.href}?folder=${encodeURIComponent(lastFolders[item.href])}` : item.href) as AppRouteWithQuery)}
				onclick={() => (isDrawerOpen = false)}
				class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium {isActive(item) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800'}"
			>
				<item.icon class="h-5 w-5 shrink-0" />
				<span>{item.label}</span>
			</a>
		{/each}
		<UploadNavigation {manager} onopen={() => isDrawerOpen = false} />
		<div class="my-2 border-t border-border-line"></div>
		{#each secondaryNavItems as item (item.href)}
			<a aria-current={isActive(item) ? 'page' : undefined} href={resolve(item.href)} onclick={() => (isDrawerOpen = false)} class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium {isActive(item) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800'}">
				<item.icon class="h-5 w-5 shrink-0" />
				<span>{item.label}</span>
			</a>
		{/each}
		<button type="button" onclick={() => { isDrawerOpen = false; onSignOut(); }} class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800">
			<SignOut class="h-5 w-5 shrink-0" />
			<span>Wyloguj</span>
		</button>
	</nav>
{/if}
