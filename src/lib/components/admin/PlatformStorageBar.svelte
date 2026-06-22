<script lang="ts">
	import { formatFileSize } from '$lib/utils/format';

	let {
		label,
		usedBytes,
		limitBytes
	} = $props<{
		label: string;
		usedBytes: number;
		limitBytes: number;
	}>();

	let percent = $derived(limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0);
	let barWidth = $derived(Math.min(percent, 100));
	let isOverLimit = $derived(percent > 100);
</script>

<div class="space-y-2">
	<div class="flex items-baseline justify-between gap-3">
		<span class="text-sm font-medium text-text-main">{label}</span>
		<span class="font-mono text-xs text-text-muted">
			{formatFileSize(usedBytes)} / {formatFileSize(limitBytes)}
			{#if isOverLimit}
				<span class="text-amber-600 dark:text-amber-500">({Math.round(percent)}%)</span>
			{/if}
		</span>
	</div>
	<div
		class="h-2 overflow-hidden rounded-full bg-border-line"
		role="progressbar"
		aria-valuenow={Math.round(percent)}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="{label}: {formatFileSize(usedBytes)} z {formatFileSize(limitBytes)}"
	>
		<div
			class="h-full transition-all duration-500 {isOverLimit
				? 'bg-amber-500'
				: 'bg-primary'}"
			style="width: {barWidth}%"
		></div>
	</div>
</div>