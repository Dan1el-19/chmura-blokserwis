<script lang="ts">
	import { Users, Database, Crown, Sparkle, User } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import Card from '$lib/components/ui/Card.svelte';

	let { data } = $props();

	// Determine colors/icons dynamically or just hardcode for reliability
</script>

<div class="space-y-6">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Total Users -->
		<Card
			class="border-border-line bg-bg-panel p-0 transition-all hover:bg-gray-50 dark:hover:bg-zinc-800/50"
		>
			<div class="flex items-center gap-4">
				<div class="rounded-full bg-blue-100/50 p-2.5 dark:bg-blue-900/20">
					<Users class="h-5 w-5 text-primary" />
				</div>
				<div class="flex flex-col">
					<span class="text-xs font-medium tracking-wider text-text-muted uppercase"
						>Total Users</span
					>
					<span class="font-mono text-2xl font-bold text-text-main">{data.stats.totalUsers}</span>
				</div>
			</div>
		</Card>

		<!-- Basic -->
		<Card class="border-border-line bg-bg-panel p-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
			<div class="flex items-center gap-4">
				<div class="rounded-full bg-gray-100 p-2.5 dark:bg-zinc-800">
					<User class="h-5 w-5 text-gray-600 dark:text-gray-400" />
				</div>
				<div class="flex flex-col">
					<span class="text-xs font-medium tracking-wider text-text-muted uppercase">Basic</span>
					<span class="font-mono text-2xl font-bold text-text-main"
						>{data.stats.usersByRole.basic}</span
					>
				</div>
			</div>
		</Card>

		<!-- Plus -->
		<Card class="border-border-line bg-bg-panel p-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
			<div class="flex items-center gap-4">
				<div class="rounded-full bg-purple-100/50 p-2.5 dark:bg-purple-900/20">
					<Sparkle class="h-5 w-5 text-purple-600 dark:text-purple-400" />
				</div>
				<div class="flex flex-col">
					<span class="text-xs font-medium tracking-wider text-text-muted uppercase">Plus</span>
					<span class="font-mono text-2xl font-bold text-text-main"
						>{data.stats.usersByRole.plus}</span
					>
				</div>
			</div>
		</Card>

		<!-- Admin -->
		<Card class="border-border-line bg-bg-panel p-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
			<div class="flex items-center gap-4">
				<div class="rounded-full bg-amber-100/50 p-2.5 dark:bg-amber-900/20">
					<Crown class="h-5 w-5 text-amber-600 dark:text-amber-500" />
				</div>
				<div class="flex flex-col">
					<span class="text-xs font-medium tracking-wider text-text-muted uppercase">Admin</span>
					<span class="font-mono text-2xl font-bold text-text-main"
						>{data.stats.usersByRole.admin}</span
					>
				</div>
			</div>
		</Card>
	</div>

	<!-- Storage -->
	<Card title="System Storage">
		<div class="flex items-center gap-4">
			<div class="rounded-full bg-green-100/50 p-3 dark:bg-green-900/20">
				<Database class="h-6 w-6 text-green-600 dark:text-green-500" />
			</div>
			<div>
				<p class="font-mono text-3xl font-bold text-text-main">
					{formatFileSize(data.stats.totalStorage)}
				</p>
				<p class="text-sm text-text-muted">Total allocated size across all buckets</p>
			</div>
		</div>
	</Card>
</div>
