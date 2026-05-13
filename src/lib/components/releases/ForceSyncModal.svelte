<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { ArrowsClockwise } from 'phosphor-svelte';
	import type { ParsedRelease } from '$lib/types/releases';

	type Props = {
		release: ParsedRelease;
		onConfirm: (data: { forceUpdate: boolean; channel: 'stable' | 'beta' }) => void;
		onCancel: () => void;
		loading?: boolean;
	};

	let { release, onConfirm, onCancel, loading = false }: Props = $props();

	let forceUpdate = $state(true);
	let channel = $state<'stable' | 'beta'>('stable');

	function handleSubmit(e: Event) {
		e.preventDefault();
		onConfirm({ forceUpdate, channel });
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="force-sync-title"
>
	<Card class="w-full max-w-md border-border-line bg-bg-panel shadow-lg" title="Manual Sync">
		<h2 id="force-sync-title" class="sr-only">Manual Sync</h2>
		<form onsubmit={handleSubmit} class="space-y-6">
			<div class="rounded-md bg-gray-50 p-3 dark:bg-zinc-800/50">
				<p class="text-sm font-medium text-text-main">
					Sync target: <span class="font-bold text-primary">{release.name}</span>
				</p>
			</div>

			<p class="text-sm text-text-muted">
				Wymuszasz aktualizację zewnętrznej konfiguracji aplikacji do tej wersji. Wybierz kanał
				dystrybucji.
			</p>

			<div class="space-y-2">
				<p class="block text-sm font-medium text-text-muted">Kanał</p>
				<div class="flex gap-3">
					<label class="flex cursor-pointer items-center gap-2 select-none">
						<input
							type="radio"
							name="channel"
							value="stable"
							bind:group={channel}
							class="h-4 w-4 border-border-line text-primary focus:ring-primary"
						/>
						<span class="text-sm font-medium text-text-main">stable</span>
					</label>
					<label class="flex cursor-pointer items-center gap-2 select-none">
						<input
							type="radio"
							name="channel"
							value="beta"
							bind:group={channel}
							class="h-4 w-4 border-border-line text-primary focus:ring-primary"
						/>
						<span class="text-sm font-medium text-text-main">beta</span>
					</label>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<input
					type="checkbox"
					id="forceUpdate"
					bind:checked={forceUpdate}
					class="h-4 w-4 rounded border-border-line text-primary focus:ring-primary"
				/>
				<label
					for="forceUpdate"
					class="cursor-pointer text-sm font-medium text-text-main select-none"
				>
					Wymagaj aktualizacji (Force Update)
				</label>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Cancel</Button>
				<Button type="submit" {loading}>
					<ArrowsClockwise class="mr-2 h-4 w-4" />
					Synchronizuj
				</Button>
			</div>
		</form>
	</Card>
</div>
