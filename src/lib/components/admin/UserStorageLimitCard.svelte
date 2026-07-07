<script lang="ts">
	import { FloppyDisk } from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { formatFileSize } from '$lib/utils/format';

	let {
		customLimit = $bindable(),
		usage,
		trashUsage = 0,
		totalUsage = usage + trashUsage,
		limit,
		roleLimitBytes,
		saving,
		onSave
	} = $props<{
		customLimit: string;
		usage: number;
		trashUsage?: number;
		totalUsage?: number;
		limit: number;
		roleLimitBytes: number;
		saving: boolean;
		onSave: () => void;
	}>();

	function formatLimit(bytes: number) {
		return bytes === Infinity ? 'Bez limitu' : formatFileSize(bytes);
	}
</script>

<Card title="Limit magazynu" description="Ustaw indywidualny limit miejsca dla tego użytkownika.">
	<div class="space-y-4">
		<div class="rounded-md bg-bg-app p-3">
			<p class="text-sm text-text-muted">Obecne użycie</p>
			<div class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
				<span class="text-text-muted">Aktywne</span>
				<span class="text-right font-mono font-semibold text-text-main">
					{formatFileSize(usage)} / {limit === Infinity ? 'Bez limitu' : formatFileSize(limit)}
				</span>
				<span class="text-text-muted">Kosz</span>
				<span class="text-right font-mono text-text-main">{formatFileSize(trashUsage)}</span>
				<span class="text-text-muted">Razem</span>
				<span class="text-right font-mono text-text-main">{formatFileSize(totalUsage)}</span>
			</div>
		</div>

		<div class="flex items-end gap-2">
			<Input
				type="number"
				label="Limit indywidualny (GB)"
				bind:value={customLimit}
				placeholder="Domyślny"
				class="flex-1"
			/>
		</div>
		<p class="text-xs text-text-muted">
			Obecny limit roli: {formatLimit(roleLimitBytes)}
		</p>
	</div>

	{#snippet footer()}
		<Button onclick={onSave} disabled={saving} class="w-full">
			<FloppyDisk class="mr-2 h-4 w-4" />
			Zapisz limit
		</Button>
	{/snippet}
</Card>
