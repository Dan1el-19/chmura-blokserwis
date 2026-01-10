<script lang="ts">
	import {
		CaretLeft,
		CaretRight,
		ArrowSquareOut,
		Crown,
		Sparkle,
		User as UserIcon
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	const roleConfig = {
		basic: {
			label: 'Basic',
			icon: UserIcon,
			class: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300'
		},
		plus: {
			label: 'Plus',
			icon: Sparkle,
			class: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
		},
		admin: {
			label: 'Admin',
			icon: Crown,
			class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
		}
	};

	const STORAGE_LIMITS = {
		basic: 5 * 1024 * 1024 * 1024,
		plus: 10 * 1024 * 1024 * 1024,
		admin: Infinity
	};

	function getStorageLimit(role: 'basic' | 'plus' | 'admin') {
		const limit = STORAGE_LIMITS[role];
		return limit === Infinity ? '∞' : formatFileSize(limit);
	}

	const formatDate = (date: string) => new Date(date).toLocaleDateString('pl-PL');
</script>

<div class="space-y-6">
	<!-- Desktop Table -->
	<div class="hidden overflow-hidden rounded-md border border-border-line bg-bg-panel lg:block">
		<table class="w-full text-left text-sm">
			<thead
				class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
			>
				<tr>
					<th class="px-6 py-3 font-medium">User</th>
					<th class="px-6 py-3 font-medium">Joined</th>
					<th class="px-6 py-3 font-medium">Role</th>
					<th class="px-6 py-3 font-medium">Storage</th>
					<th class="px-6 py-3 text-right font-medium">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-line">
				{#each data.users as user}
					{@const config = roleConfig[user.role]}
					<tr class="transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50">
						<td class="px-6 py-4">
							<div class="flex flex-col">
								<span class="font-medium text-text-main">{user.email}</span>
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
								class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {config.class}"
							>
								<!-- Dynamic Component for icon -->
								<config.icon class="h-3.5 w-3.5" />
								{config.label}
							</span>
						</td>
						<td class="px-6 py-4 font-mono text-xs text-text-muted">
							{formatFileSize(user.storageUsage)} / {getStorageLimit(user.role)}
						</td>
						<td class="px-6 py-4 text-right">
							<a
								href="/admin/users/{user.$id}"
								class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
							>
								Details
								<ArrowSquareOut class="h-3.5 w-3.5" />
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile Cards -->
	<div class="space-y-3 lg:hidden">
		{#each data.users as user}
			{@const config = roleConfig[user.role]}
			<Card class="p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium text-text-main">{user.email}</p>
						{#if user.name}
							<p class="truncate text-sm text-text-muted">{user.name}</p>
						{/if}
					</div>
					<span
						class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium {config.class}"
					>
						<config.icon class="h-3 w-3" />
						{config.label}
					</span>
				</div>

				<div
					class="mt-4 flex items-center justify-between border-t border-border-line pt-3 text-xs text-text-muted"
				>
					<div class="font-mono">{formatDate(user.$createdAt)}</div>
					<div class="font-mono">
						{formatFileSize(user.storageUsage)} / {getStorageLimit(user.role)}
					</div>
				</div>

				<div class="mt-3 flex justify-end">
					<a href="/admin/users/{user.$id}">
						<Button size="sm" variant="ghost" class="h-7 gap-1 text-xs">
							Details <ArrowSquareOut class="h-3 w-3" />
						</Button>
					</a>
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
