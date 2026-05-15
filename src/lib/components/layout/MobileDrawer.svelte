<script lang="ts">
	import { SignOut } from 'phosphor-svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut, quintOut } from 'svelte/easing';
	import type { Component } from 'svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
		color: string;
		roles: string[];
	}

	let {
		navItems,
		currentPath,
		isDrawerOpen = $bindable()
	} = $props<{
		navItems: NavItem[];
		currentPath: string;
		isDrawerOpen: boolean;
	}>();

	const primaryNavItems = $derived(navItems.filter((item: NavItem) => item.href !== '/trash'));
	const trashNavItem = $derived(navItems.find((item: NavItem) => item.href === '/trash'));
	const trashIndex = $derived(primaryNavItems.length);
	const logoutIndex = $derived(primaryNavItems.length + (trashNavItem ? 1 : 0));

	function itemDelay(index: number) {
		return 35 + index * 38;
	}

	function activeBgFor(item: NavItem) {
		if (item.color === 'bg-blue-500') return 'bg-blue-50 dark:bg-blue-900/20';
		if (item.color === 'bg-emerald-500') return 'bg-emerald-50 dark:bg-emerald-900/20';
		if (item.color === 'bg-violet-500') return 'bg-violet-50 dark:bg-violet-900/20';
		if (item.color === 'bg-orange-500') return 'bg-orange-50 dark:bg-orange-900/20';
		if (item.color === 'bg-red-500') return 'bg-red-50 dark:bg-red-900/20';
		return 'bg-bg-panel';
	}
</script>

{#if isDrawerOpen}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-20 mt-14 bg-black/30 backdrop-blur-md lg:hidden"
		onclick={() => (isDrawerOpen = false)}
		aria-label="Zamknij menu"
		transition:scale={{ duration: 200, start: 0.98, opacity: 0 }}
	></button>

	<!-- Mobile Nav Menu -->
	<nav
		class="fixed top-14 right-0 left-0 z-30 flex flex-col gap-2 p-4 lg:hidden"
		in:fly={{ y: -20, duration: 300, easing: quintOut }}
		out:fly={{ y: -10, duration: 150 }}
	>
		{#each primaryNavItems as item, i}
			{@const isActive = currentPath === item.href}
			{@const activeBg = activeBgFor(item)}
			<a
				href={item.href}
				class="flex items-center gap-4 rounded-full py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]
								   {isActive ? activeBg : 'bg-bg-panel'}"
				in:fly={{ y: -24, duration: 280, delay: itemDelay(i), easing: backOut }}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full {item.color} text-white"
				>
					<item.icon class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-base font-medium text-text-main">{item.label}</span>
			</a>
		{/each}

		{#if trashNavItem}
			{@const isActive = currentPath === trashNavItem.href}
			<a
				href={trashNavItem.href}
				class="mt-2 flex items-center gap-4 rounded-full py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]
								   {isActive ? activeBgFor(trashNavItem) : 'bg-bg-panel'}"
				in:fly={{
					y: -24,
					duration: 280,
					delay: itemDelay(trashIndex),
					easing: backOut
				}}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full {trashNavItem.color} text-white"
				>
					<trashNavItem.icon class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-base font-medium text-text-main">{trashNavItem.label}</span>
			</a>
		{/if}

		<!-- Logout -->
		<form action="/logout" method="POST">
			<button
				type="submit"
				class="flex w-full items-center gap-4 rounded-full bg-bg-panel py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]"
				in:fly={{ y: -24, duration: 280, delay: itemDelay(logoutIndex), easing: backOut }}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
					<SignOut class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-base font-medium text-text-main">Wyloguj</span>
			</button>
		</form>
	</nav>
{/if}
