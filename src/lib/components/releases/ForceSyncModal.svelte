<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { ArrowsClockwise } from 'phosphor-svelte';
	import type { ParsedRelease } from '$lib/types/releases';

	type Props = {
		release: ParsedRelease;
		onConfirm: (data: { forceUpdate: boolean }) => void;
		onCancel: () => void;
		loading?: boolean;
	};

	let { release, onConfirm, onCancel, loading = false }: Props = $props();

	let forceUpdate = $state(true);

	function handleSubmit(e: Event) {
		e.preventDefault();
		onConfirm({ forceUpdate });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm">
	<Card class="w-full max-w-md border-border-line bg-bg-panel shadow-lg" title="Manual Sync">
		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="rounded-md bg-gray-50 p-3 dark:bg-zinc-800/50">
				<p class="text-sm font-medium text-text-main">Sync target: <span class="font-bold text-primary">{release.name}</span></p>
			</div>
            
			<p class="text-sm text-text-muted">
				You are about to force external app configuration to match this release. This action sets the latest version available over-the-air.
			</p>

			<div class="flex items-center gap-3">
				<input
					type="checkbox"
					id="forceUpdate"
					bind:checked={forceUpdate}
					class="h-4 w-4 rounded border-border-line text-primary focus:ring-primary"
				/>
				<label for="forceUpdate" class="text-sm font-medium text-text-main cursor-pointer select-none">
					Require app update (Force Update)
				</label>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Cancel</Button>
				<Button type="submit" {loading}>
					<ArrowsClockwise class="mr-2 h-4 w-4" />
					Synchronize
				</Button>
			</div>
		</form>
	</Card>
</div>
