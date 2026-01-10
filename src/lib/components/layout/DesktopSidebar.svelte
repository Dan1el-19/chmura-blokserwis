<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { SignOut } from 'phosphor-svelte';
	import type { Component } from 'svelte';

	interface NavItem {
		href: string;
		label: string;
		icon: Component;
		color: string;
		roles: string[];
	}

	let { navItems, currentPath } = $props<{
		navItems: NavItem[];
		currentPath: string;
	}>();
</script>

<aside
	class="sticky top-0 hidden h-dvh w-[280px] shrink-0 flex-col border-r border-border-line bg-bg-panel lg:flex"
>
	<div class="relative flex h-16 items-center border-b border-border-line px-6">
		<img src={favicon} alt="" class="h-6 w-6" />
		<span
			class="absolute left-1/2 -translate-x-1/2 font-mono text-base font-bold tracking-tight text-text-main"
			>Effinity Cloud</span
		>
	</div>

	<nav class="flex-1 space-y-1.5 p-5">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                           {currentPath === item.href
					? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
					: 'text-text-muted hover:bg-gray-50 hover:text-text-main dark:hover:bg-zinc-800'}"
			>
				<item.icon class="h-5 w-5" />
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="border-t border-border-line p-4">
		<form action="/logout" method="POST">
			<button
				type="submit"
				class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400"
			>
				<SignOut class="h-5 w-5" />
				Log out
			</button>
		</form>
	</div>
</aside>
