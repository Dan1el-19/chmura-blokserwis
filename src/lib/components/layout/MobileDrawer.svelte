<script lang="ts">
	import UploadNavigation from './UploadNavigation.svelte';
	import type { UploadManager } from '#lib/upload-manager.svelte.js';
	import { SignOut } from 'phosphor-svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut, quintOut } from 'svelte/easing';
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
	const primaryNavItems = $derived(
		navItems.filter((item) => item.href !== '/trash' && item.href !== '/settings')
	);
	const secondaryNavItems = $derived(
		navItems.filter((item) => item.href === '/trash' || item.href === '/settings')
	);

	function itemDelay(index: number) {
		return 35 + index * 38;
	}

	function activeBgFor(item: NavItem) {
		if (item.color === 'bg-blue-500') return 'bg-blue-50 dark:bg-blue-900/20';
		if (item.color === 'bg-emerald-500') return 'bg-emerald-50 dark:bg-emerald-900/20';
		if (item.color === 'bg-red-500') return 'bg-red-50 dark:bg-red-900/20';
		return 'bg-bg-panel';
	}
</script>

{#if isDrawerOpen}
	<button
		type="button"
		class="fixed inset-0 z-20 mt-14 bg-black/30 backdrop-blur-md lg:hidden"
		onclick={() => (isDrawerOpen = false)}
		aria-label="Zamknij menu"
		transition:scale={{ duration: 200, start: 0.98, opacity: 0 }}
	></button>
	<nav
		class="fixed top-14 left-0 z-30 flex w-screen max-w-[100vw] flex-col gap-2 overflow-x-hidden p-4 lg:hidden"
		aria-label="Nawigacja mobilna"
		in:fly={{ y: -20, duration: 300, easing: quintOut }}
		out:fly={{ y: -10, duration: 150 }}
	>
		{#each primaryNavItems as item, i (item.href)}
			<a
				href={resolve((lastFolders[item.href] ? `${item.href}?folder=${encodeURIComponent(lastFolders[item.href])}` : item.href) as AppRouteWithQuery)}
				onclick={() => (isDrawerOpen = false)}
				class="flex w-full min-w-0 items-center gap-4 rounded-full py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]
					{currentPath === item.href || currentPath.startsWith(`${item.href}/`) ? activeBgFor(item) : 'bg-bg-panel'}"
				in:fly={{ y: -24, duration: 280, delay: itemDelay(i), easing: backOut }}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<span class="flex h-10 w-10 items-center justify-center rounded-full {item.color} text-white">
					<item.icon class="h-5 w-5" weight="bold" />
				</span>
				<span class="text-base font-medium text-text-main">{item.label}</span>
			</a>
		{/each}

		<UploadNavigation {manager} onopen={() => isDrawerOpen = false} />
		{#each secondaryNavItems as item, index (item.href)}
			<a
				href={resolve(item.href)}
				onclick={() => (isDrawerOpen = false)}
				class="mt-2 flex w-full min-w-0 items-center gap-4 rounded-full py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]
					{currentPath === item.href ? activeBgFor(item) : 'bg-bg-panel'}"
				in:fly={{ y: -24, duration: 280, delay: itemDelay(primaryNavItems.length + index), easing: backOut }}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<span class="flex h-10 w-10 items-center justify-center rounded-full {item.color} text-white">
					<item.icon class="h-5 w-5" weight="bold" />
				</span>
				<span class="text-base font-medium text-text-main">{item.label}</span>
			</a>
		{/each}

		<button
			type="button"
			onclick={() => {
				isDrawerOpen = false;
				onSignOut();
			}}
			class="flex w-full items-center gap-4 rounded-full bg-bg-panel py-3 pr-6 pl-3 text-left shadow-lg transition-transform active:scale-[0.98]"
			in:fly={{ y: -24, duration: 280, delay: itemDelay(primaryNavItems.length + secondaryNavItems.length), easing: backOut }}
			out:scale={{ duration: 100, start: 0.95 }}
		>
			<span class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
				<SignOut class="h-5 w-5" weight="bold" />
			</span>
			<span class="text-base font-medium text-text-main">Wyloguj</span>
		</button>
	</nav>
{/if}
