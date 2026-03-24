<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import TagsInput from './TagsInput.svelte';
	import type { ParsedRelease } from '$lib/types/releases';

	type Props = {
		release: ParsedRelease;
		onSave: (data: { tags: string[]; notes: string }) => void;
		onCancel: () => void;
		loading?: boolean;
	};

	import { untrack } from 'svelte';

	let { release, onSave, onCancel, loading = false }: Props = $props();

	let tags = $state<string[]>(untrack(() => [...release.tags]));
	let notes = $state(untrack(() => release.notes || ''));

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSave({ tags, notes });
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm">
	<Card class="w-full max-w-md border-border-line bg-bg-panel shadow-lg" title="Edit Release">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="rounded-md bg-gray-50 p-3 dark:bg-zinc-800/50">
				<p class="text-sm font-medium text-text-main">{release.name}</p>
			</div>

			<TagsInput bind:value={tags} label="Tags" placeholder="Add version tags..." />

			<div class="space-y-1.5">
				<label for="notes" class="block text-sm font-medium text-text-muted">Notes</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Release notes, changelog..."
					rows="4"
					class="w-full rounded-md border border-border-line bg-transparent px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
				></textarea>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Cancel</Button>
				<Button type="submit" {loading}>Save Changes</Button>
			</div>
		</form>
	</Card>
</div>
