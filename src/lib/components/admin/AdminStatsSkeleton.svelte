<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
</script>

<div class="space-y-6">
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each Array(4) as _, i (i)}
			<Card class="border-border-line bg-bg-panel p-0">
				<div class="flex items-center gap-4">
					<Skeleton class="h-10 w-10 rounded-full" />
					<div class="flex flex-col gap-1.5">
						<Skeleton class="h-2.5 w-20" />
						<Skeleton class="h-6 w-12" />
					</div>
				</div>
			</Card>
		{/each}
	</div>

	<Card title="Magazyn systemowy">
		<div class="flex items-center gap-4">
			<Skeleton class="h-12 w-12 rounded-full" />
			<div class="flex flex-col gap-2">
				<Skeleton class="h-7 w-28" />
				<Skeleton class="h-3 w-56 max-w-full" />
			</div>
		</div>
	</Card>
</div>
