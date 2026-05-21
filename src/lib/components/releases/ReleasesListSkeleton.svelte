<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';

	type Props = {
		rows?: number;
	};

	let { rows = 4 }: Props = $props();
</script>

<div class="overflow-hidden rounded-md border border-border-line">
	<table class="w-full text-sm">
		<thead class="border-b border-border-line bg-gray-50 dark:bg-zinc-800/50">
			<tr>
				<th class="px-4 py-3 text-left"><Skeleton class="h-3 w-16" /></th>
				<th class="hidden px-4 py-3 text-left sm:table-cell"><Skeleton class="h-3 w-14" /></th>
				<th class="hidden px-4 py-3 text-left md:table-cell"><Skeleton class="h-3 w-10" /></th>
				<th class="hidden px-4 py-3 text-left lg:table-cell"><Skeleton class="h-3 w-20" /></th>
				<th class="px-4 py-3 text-right"><Skeleton class="ml-auto h-3 w-14" /></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border-line">
			{#each Array(rows) as _, i (i)}
				<tr>
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<Skeleton class="h-5 w-5 shrink-0 rounded-md" />
							<Skeleton class="h-3.5 w-40 max-w-full" />
						</div>
					</td>
					<td class="hidden px-4 py-3 sm:table-cell"><Skeleton class="h-3 w-16" /></td>
					<td class="hidden px-4 py-3 md:table-cell">
						<div class="flex gap-1">
							<Skeleton class="h-4 w-12 rounded-full" />
							<Skeleton class="h-4 w-10 rounded-full" />
						</div>
					</td>
					<td class="hidden px-4 py-3 lg:table-cell"><Skeleton class="h-3 w-28" /></td>
					<td class="px-4 py-3">
						<div class="flex justify-end gap-1">
							<Skeleton class="h-8 w-8 rounded-md" />
							<Skeleton class="h-8 w-8 rounded-md" />
							<Skeleton class="h-8 w-8 rounded-md" />
							<Skeleton class="h-8 w-8 rounded-md" />
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
