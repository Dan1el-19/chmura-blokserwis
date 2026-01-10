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
</script>

{#if isDrawerOpen}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-20 mt-14 bg-black/30 backdrop-blur-md lg:hidden"
		onclick={() => (isDrawerOpen = false)}
		aria-label="Close menu"
		transition:scale={{ duration: 200, start: 0.98, opacity: 0 }}
	></button>

	<!-- Mobile Nav Menu -->
	<nav
		class="fixed top-14 right-0 left-0 z-30 flex flex-col gap-2 p-4 lg:hidden"
		in:fly={{ y: -20, duration: 300, easing: quintOut }}
		out:fly={{ y: -10, duration: 150 }}
	>
		{#each navItems as item, i}
			{@const isActive = currentPath === item.href}
			{@const activeBg =
				item.color === 'bg-blue-500'
					? 'bg-blue-50 dark:bg-blue-900/20'
					: item.color === 'bg-emerald-500'
						? 'bg-emerald-50 dark:bg-emerald-900/20'
						: item.color === 'bg-violet-500'
							? 'bg-violet-50 dark:bg-violet-900/20'
							: 'bg-bg-panel'}
			<a
				href={item.href}
				class="flex items-center gap-4 rounded-full py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]
								   {isActive ? activeBg : 'bg-bg-panel'}"
				in:fly={{ y: -15, duration: 250, delay: 50 + i * 50, easing: backOut }}
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

		<!-- Logout -->
		<form action="/logout" method="POST" class="mt-2">
			<button
				type="submit"
				class="flex w-full items-center gap-4 rounded-full bg-bg-panel py-3 pr-6 pl-3 shadow-lg transition-transform active:scale-[0.98]"
				in:fly={{ y: -15, duration: 250, delay: 50 + navItems.length * 50, easing: backOut }}
				out:scale={{ duration: 100, start: 0.95 }}
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white">
					<SignOut class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-base font-medium text-text-main">Log out</span>
			</button>
		</form>
	</nav>
{/if}
