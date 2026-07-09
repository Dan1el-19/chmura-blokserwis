<script lang="ts">
	import {
		CaretLeft,
		CaretRight,
		ArrowSquareOut,
		Crown,
		Sparkle,
		User as UserIcon,
		UsersThree
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	const roleConfig = {
		basic: {
			label: 'Podstawowy',
			icon: UserIcon,
			class: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300'
		},
		plus: {
			label: 'Plus',
			icon: Sparkle,
			class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
		},
		admin: {
			label: 'Administrator',
			icon: Crown,
			class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
		}
	};

	function formatStorageLimit(limit: number | null | undefined) {
		if (limit == null) return 'Bez limitu';
		return limit === Infinity ? '∞' : formatFileSize(limit);
	}

	function formatStorageBreakdown(user: {
		storageUsage: number;
		storageTrashUsage: number;
		storageTotalUsage: number;
		storageLimit: number | null;
	}) {
		return [
			{ label: 'Aktywne', value: formatFileSize(user.storageUsage) },
			{ label: 'Kosz', value: formatFileSize(user.storageTrashUsage) },
			{
				label: 'Razem',
				value: `${formatFileSize(user.storageTotalUsage)} / ${formatStorageLimit(user.storageLimit)}`
			}
		];
	}

	const formatDate = (date: string) => new Date(date).toLocaleDateString('pl-PL');
</script>

<div class="space-y-6">
	<section
		class="flex flex-col gap-4 border-b border-border-line pb-5 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Konta i limity</p>
			<h2 class="mt-2 text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
				Użytkownicy
			</h2>
			<p class="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
				Przeglądaj role i rzeczywiste użycie miejsca — również dane pozostawione w koszu.
			</p>
		</div>
		<div
			class="inline-flex w-fit items-center gap-2 rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm text-text-muted"
		>
			<UsersThree class="h-4 w-4 text-primary" />
			<span
				><span class="font-mono font-semibold text-text-main">{data.total}</span> wszystkich kont</span
			>
		</div>
	</section>

	<!-- Desktop Table -->
	<div class="hidden overflow-hidden rounded-md border border-border-line bg-bg-panel xl:block">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[960px] text-left text-sm">
				<thead
					class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
				>
					<tr>
						<th class="px-6 py-3 font-medium">Użytkownik</th>
						<th class="px-6 py-3 font-medium">Dołączył</th>
						<th class="px-6 py-3 font-medium">Rola</th>
						<th class="px-6 py-3 font-medium">Magazyn</th>
						<th class="px-6 py-3 text-right font-medium">Akcje</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-line">
					{#each data.users as user (user.$id)}
						<tr class="group transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50">
							<td class="px-6 py-4">
								<div class="flex flex-col">
									<a
										href="/admin/users/{user.$id}"
										class="w-fit font-medium text-text-main underline-offset-4 group-hover:text-primary group-hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
									>
										{user.email}
									</a>
									{#if user.name}
										<span class="text-xs text-text-muted">{user.name}</span>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 font-mono text-xs text-text-muted">
								{formatDate(user.$createdAt)}
							</td>
							<td class="px-6 py-4">
								<span
									class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {roleConfig[
										user.role
									].class}"
								>
									{#if user.role === 'admin'}
										<Crown class="h-3.5 w-3.5" />
									{:else if user.role === 'plus'}
										<Sparkle class="h-3.5 w-3.5" />
									{:else}
										<UserIcon class="h-3.5 w-3.5" />
									{/if}
									{roleConfig[user.role].label}
								</span>
							</td>
							<td class="px-6 py-4 text-xs text-text-muted">
								<div class="grid min-w-56 grid-cols-[auto_1fr] gap-x-3 gap-y-1">
									{#each formatStorageBreakdown(user) as item (item.label)}
										<span>{item.label}</span>
										<span class="text-right font-mono text-text-main">{item.value}</span>
									{/each}
								</div>
							</td>
							<td class="px-6 py-4 text-right">
								<a
									href="/admin/users/{user.$id}"
									class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
								>
									Szczegóły
									<ArrowSquareOut class="h-3.5 w-3.5" />
								</a>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="px-6 py-14 text-center text-sm text-text-muted">
								Nie znaleziono użytkowników na tej stronie.
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Mobile Cards -->
	<div class="space-y-3 xl:hidden">
		{#each data.users as user (user.$id)}
			<a
				href="/admin/users/{user.$id}"
				class="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
			>
				<Card class="group-hover:border-primary/40 group-hover:bg-primary/[0.015]">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium text-text-main">{user.email}</p>
							{#if user.name}
								<p class="truncate text-sm text-text-muted">{user.name}</p>
							{/if}
						</div>
						<span
							class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium {roleConfig[
								user.role
							].class}"
						>
							{#if user.role === 'admin'}
								<Crown class="h-3 w-3" />
							{:else if user.role === 'plus'}
								<Sparkle class="h-3 w-3" />
							{:else}
								<UserIcon class="h-3 w-3" />
							{/if}
							{roleConfig[user.role].label}
						</span>
					</div>

					<div
						class="mt-4 grid gap-3 border-t border-border-line pt-3 text-xs text-text-muted sm:grid-cols-[auto_1fr] sm:items-end"
					>
						<div>
							<p class="text-[11px] font-medium tracking-wide uppercase">Dołączył</p>
							<p class="mt-1 font-mono text-text-main">{formatDate(user.$createdAt)}</p>
						</div>
						<div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 sm:justify-self-end">
							{#each formatStorageBreakdown(user) as item (item.label)}
								<span>{item.label}</span>
								<span class="text-right font-mono text-text-main">{item.value}</span>
							{/each}
						</div>
					</div>

					<div
						class="mt-4 flex items-center justify-between border-t border-border-line pt-3 text-sm font-medium text-primary"
					>
						<span>Otwórz profil użytkownika</span>
						<ArrowSquareOut class="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
					</div>
				</Card>
			</a>
		{:else}
			<Card>
				<div class="py-8 text-center text-sm text-text-muted">
					Nie znaleziono użytkowników na tej stronie.
				</div>
			</Card>
		{/each}
	</div>

	<!-- Pagination -->
	{#if data.totalPages > 1}
		<div class="flex items-center justify-center gap-2 pt-4">
			<a
				href="?page={data.page - 1}"
				class:pointer-events-none={data.page <= 1}
				class:opacity-50={data.page <= 1}
			>
				<Button variant="secondary" size="icon" disabled={data.page <= 1}>
					<CaretLeft class="h-4 w-4" />
				</Button>
			</a>
			<span class="px-2 font-mono text-sm text-text-muted">
				{data.page} / {data.totalPages}
			</span>
			<a
				href="?page={data.page + 1}"
				class:pointer-events-none={data.page >= data.totalPages}
				class:opacity-50={data.page >= data.totalPages}
			>
				<Button variant="secondary" size="icon" disabled={data.page >= data.totalPages}>
					<CaretRight class="h-4 w-4" />
				</Button>
			</a>
		</div>
	{/if}
</div>
