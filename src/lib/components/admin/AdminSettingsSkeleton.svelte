<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
</script>

<div class="space-y-6">
	<header class="border-b border-border-line pb-4">
		<Skeleton class="h-5 w-56" />
		<Skeleton class="mt-2 h-3 w-72 max-w-full" />
	</header>

	<Card title="Rekomendowane miejsce uploadu">
		<div class="space-y-4">
			<div class="grid gap-3 sm:grid-cols-3">
				{#each Array(3) as _, i (i)}
					<div class="rounded-lg border border-border-line bg-bg-panel p-4">
						<div class="flex items-center gap-3">
							<Skeleton class="h-9 w-9 rounded-full" />
							<div class="flex-1 space-y-2">
								<Skeleton class="h-3.5 w-24" />
								<Skeleton class="h-3 w-full max-w-[200px]" />
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="flex items-center justify-between border-t border-border-line pt-4">
				<Skeleton class="h-3 w-40" />
				<Skeleton class="h-9 w-24 rounded-md" />
			</div>
		</div>
	</Card>
</div>
