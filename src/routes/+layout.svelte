<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-sonner';
	import { page } from '$app/state';
	import { Folder, GearSix, Shield, SignOut, List, X } from 'phosphor-svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut, quintOut } from 'svelte/easing';

	let { children, data } = $props();
	let isDrawerOpen = $state(false);

	function toggleDrawer() {
		isDrawerOpen = !isDrawerOpen;
	}

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

		<div class="flex min-w-0 flex-1 flex-col">
			<header
				class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-line bg-bg-panel px-4 lg:hidden"
			>
				<img src={favicon} alt="" class="h-6 w-6" />
				<span class="absolute left-1/2 -translate-x-1/2 font-mono text-sm font-bold text-text-main"
					>Effinity Cloud</span
				>
				<button
					onclick={toggleDrawer}
					class="relative flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-all duration-300
						   {isDrawerOpen}"
					aria-label="Toggle menu"
				>
					<div class="transition-transform duration-300 {isDrawerOpen ? 'rotate-90' : 'rotate-0'}">
						{#if isDrawerOpen}
							<X class="h-6 w-6" weight="bold" />
						{:else}
							<List class="h-6 w-6" />
						{/if}
					</div>
				</button>
			</header>

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
							<div
								class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white"
							>
								<SignOut class="h-5 w-5" weight="bold" />
							</div>
							<span class="text-base font-medium text-text-main">Log out</span>
						</button>
					</form>
				</nav>
			{/if}

			<main class="flex-1 overflow-y-auto overscroll-none p-4 lg:p-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
