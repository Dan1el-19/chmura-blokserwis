<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	type Props = {
		rows?: number;
	};

	let { rows = 6 }: Props = $props();
</script>

<div class="mt-4">
	<!-- Desktop table -->
	<div class="hidden overflow-hidden rounded-lg border border-border-line bg-bg-panel lg:block">
		<table class="w-full text-left text-sm">
			<thead
				class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
			>
				<tr>
					<th class="px-4 py-3"><Skeleton class="h-3 w-16" /></th>
					<th class="w-32 px-4 py-3"><Skeleton class="h-3 w-12" /></th>
					<th class="w-44 px-4 py-3"><Skeleton class="h-3 w-16" /></th>
					<th class="w-44 px-4 py-3"><Skeleton class="ml-auto h-3 w-16" /></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-line">
				{#each Array(rows) as _, i (i)}
					<tr>
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<Skeleton class="h-5 w-5 shrink-0 rounded-md" />
								<Skeleton class="h-3.5 w-48 max-w-full" />
							</div>
						</td>
						<td class="px-4 py-3"><Skeleton class="h-3 w-16" /></td>
						<td class="px-4 py-3"><Skeleton class="h-3 w-24" /></td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-2">
								<Skeleton class="h-7 w-7 rounded-md" />
								<Skeleton class="h-7 w-7 rounded-md" />
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Mobile list -->
	<div class="space-y-2 lg:hidden">
		{#each Array(rows) as _, i (i)}
			<div class="rounded-md border border-border-line bg-bg-panel p-3">
				<div class="flex items-center gap-3">
					<Skeleton class="h-8 w-8 shrink-0 rounded-md" />
					<div class="flex min-w-0 flex-1 flex-col gap-1.5">
						<Skeleton class="h-3.5 w-3/4 max-w-[220px]" />
						<Skeleton class="h-3 w-1/3 max-w-[120px]" />
					</div>
					<Skeleton class="h-9 w-9 shrink-0 rounded-md" />
				</div>
			</div>
		{/each}
	</div>
</div>
