<script lang="ts">
	import { formatFileSize } from '$lib/utils/format';

	let { usage, limit, role } = $props<{ usage: number; limit: number | null; role: string }>();

	let percentage = $derived(limit ? Math.min((usage / limit) * 100, 100) : 0);
</script>

<div class="flex items-center gap-4 font-mono text-xs text-text-muted">
	<span class="whitespace-nowrap">Magazyn:</span>
	<div class="h-1.5 w-24 overflow-hidden rounded-full bg-border-line">
		<div class="h-full bg-primary transition-all duration-500" style="width: {percentage}%"></div>
	</div>
	<span class="whitespace-nowrap">
		{#if role === 'admin' || limit === Infinity}
			{formatFileSize(usage)}
		{:else}
			{formatFileSize(usage)} / {limit === null ? 'Bez limitu' : formatFileSize(limit)}
		{/if}
	</span>
</div>
