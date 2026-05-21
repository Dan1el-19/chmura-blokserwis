<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	type Props = {
		rows?: number;
	};

	let { rows = 6 }: Props = $props();
</script>

<div class="space-y-6">
	<!-- Desktop -->
	<div class="hidden overflow-hidden rounded-md border border-border-line bg-bg-panel lg:block">
		<table class="w-full text-left text-sm">
			<thead
				class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
			>
				<tr>
					<th class="px-6 py-3"><Skeleton class="h-3 w-20" /></th>
					<th class="px-6 py-3"><Skeleton class="h-3 w-16" /></th>
					<th class="px-6 py-3"><Skeleton class="h-3 w-12" /></th>
					<th class="px-6 py-3"><Skeleton class="h-3 w-16" /></th>
					<th class="px-6 py-3 text-right"><Skeleton class="ml-auto h-3 w-16" /></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-line">
				{#each Array(rows) as _, i (i)}
					<tr>
						<td class="px-6 py-4">
							<Skeleton class="h-3.5 w-44" />
							<Skeleton class="mt-1.5 h-3 w-24" />
						</td>
						<td class="px-6 py-4"><Skeleton class="h-3 w-20" /></td>
						<td class="px-6 py-4"><Skeleton class="h-5 w-24 rounded-full" /></td>
						<td class="px-6 py-4"><Skeleton class="h-3 w-28" /></td>
						<td class="px-6 py-4"><Skeleton class="ml-auto h-3 w-16" /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile -->
	<div class="space-y-3 lg:hidden">
		{#each Array(rows) as _, i (i)}
			<Card class="p-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1 space-y-1.5">
						<Skeleton class="h-3.5 w-3/4 max-w-[220px]" />
						<Skeleton class="h-3 w-1/2 max-w-[160px]" />
					</div>
					<Skeleton class="h-5 w-20 shrink-0 rounded-full" />
				</div>
				<div class="mt-4 flex items-center justify-between border-t border-border-line pt-3">
					<Skeleton class="h-3 w-20" />
					<Skeleton class="h-3 w-28" />
				</div>
				<div class="mt-3 flex justify-end">
					<Skeleton class="h-7 w-24 rounded-md" />
				</div>
			</Card>
		{/each}
	</div>
</div>
