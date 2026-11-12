<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, description, actions }: { title: string; description?: string; actions?: Snippet } = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-4">
	<div class="min-w-0">
		<h1 class="text-2xl leading-8 font-semibold xl:text-[28px] xl:leading-9">{title}</h1>
		{#if description}<p class="mt-1 text-sm leading-5 text-text-muted">{description}</p>{/if}
	</div>
	{#if actions}{@render actions()}{/if}
</header>
