<script lang="ts">
	import { FloppyDisk } from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { formatFileSize } from '$lib/utils/format';

	let {
		customLimit = $bindable(),
		usage,
		limit,
		roleLimitBytes,
		saving,
		onSave
	} = $props<{
		customLimit: string;
		usage: number;
		limit: number;
		roleLimitBytes: number;
		saving: boolean;
		onSave: () => void;
	}>();
</script>

<Card title="Storage Limit" description="Set a custom storage quota for this user.">
	<div class="space-y-4">
		<div class="rounded-md bg-bg-app p-3">
			<p class="text-sm text-text-muted">Current Usage</p>
			<div class="flex items-baseline gap-2">
				<span class="text-lg font-bold text-text-main">
					{formatFileSize(usage)}
				</span>
				<span class="text-text-muted">/</span>
				<span class="text-sm text-text-muted">
					{limit === Infinity ? 'Unlimited' : formatFileSize(limit)}
				</span>
			</div>
		</div>

		<div class="flex items-end gap-2">
			<Input
				type="number"
				label="Custom Limit (GB)"
				bind:value={customLimit}
				placeholder="Default"
				class="flex-1"
			/>
		</div>
		<p class="text-xs text-text-muted">
			Current Role Limit: {formatFileSize(roleLimitBytes)}
		</p>
	</div>

	{#snippet footer()}
		<Button onclick={onSave} disabled={saving} class="w-full">
			<FloppyDisk class="mr-2 h-4 w-4" />
			Save Limit
		</Button>
	{/snippet}
</Card>
