<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import Card from '$lib/components/ui/Card.svelte';
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Skeleton class="h-9 w-9 rounded-md" />
		<div class="space-y-2">
			<Skeleton class="h-5 w-64 max-w-full lg:h-6" />
			<Skeleton class="h-3 w-72 max-w-full" />
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		{#each Array(4) as _, i (i)}
			<Card>
				<div class="space-y-3">
					<Skeleton class="h-3.5 w-32" />
					<Skeleton class="h-3 w-full max-w-[260px]" />
					<Skeleton class="h-9 w-full" />
					<Skeleton class="ml-auto h-9 w-24" />
				</div>
			</Card>
		{/each}
	</div>
</div>
