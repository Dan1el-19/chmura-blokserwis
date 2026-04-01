<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import TagsInput from './TagsInput.svelte';
	import { Warning, Check } from 'phosphor-svelte';
	import type { ParsedRelease } from '$lib/types/releases';
	import { untrack } from 'svelte';

	type Props = {
		file: File;
		existingRelease?: ParsedRelease | null;
		onConfirm: (data: { name: string; tags: string[]; notes: string; overwrite: boolean }) => void;
		onCancel: () => void;
	};

	let { file, existingRelease = null, onConfirm, onCancel }: Props = $props();

	let name = $state(untrack(() => file.name));
	let extractedVersion = $derived.by(() => {
		const match = name.match(/[\w\-]+-(\d+\.\d+\.\d+)[\w\-]*\.apk$/i); 
		const fallbackMatch = name.match(/(\d+\.\d+\.\d+)/);
		
		if (match) return match[1];
		return fallbackMatch ? fallbackMatch[1] : null;
	});
	
	let isValidFormat = $derived(/^blokse?rwis-\d+\.\d+\.\d+\.apk$/i.test(name));

	let tags = $state<string[]>([]);
	let notes = $state('');
	let overwrite = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		onConfirm({ name, tags, notes, overwrite });
	}

	function formatSize(bytes: number): string {
		if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
		if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${bytes} B`;
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm">
	<Card class="w-full max-w-md border-border-line bg-bg-panel shadow-lg" title="Upload Release">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/50">
				<p class="text-sm text-text-muted">
					Selected file: <span class="font-medium text-text-main">{name}</span>
				</p>
				<p class="mt-1 text-xs text-text-muted">
					<span title={file.name}>Original file: {file.name.length > 25 ? file.name.substring(0, 25) + '...' : file.name}</span>
					<span class="mx-1">•</span> 
					Size: {formatSize(file.size)}
				</p>
			</div>

			{#if existingRelease}
				<div
					class="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3"
				>
					<Warning class="h-5 w-5 shrink-0 text-yellow-500" weight="fill" />
					<div class="space-y-2 text-sm">
						<p class="font-medium text-yellow-600 dark:text-yellow-400">
							A release with this name already exists
						</p>
						<p class="text-text-muted">
							Existing version uploaded on {new Date(
								existingRelease.$createdAt
							).toLocaleDateString()}
							({formatSize(existingRelease.size)})
						</p>
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={overwrite}
								class="h-4 w-4 rounded border-border-line text-primary focus:ring-primary"
							/>
							<span class="text-text-main">Overwrite existing release</span>
						</label>
					</div>
				</div>
			{/if}

			<div class="space-y-1">
				<Input bind:value={name} label="Filename" placeholder="blokserwis-1.4.0.apk" required />
				<div class="flex items-center gap-2 flex-wrap pb-2 pt-1">
					{#if extractedVersion}
						<span class="inline-flex items-center rounded-md bg-green-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-green-600 dark:text-green-400 border border-green-500/20">
							Version: v{extractedVersion}
						</span>
					{:else}
						<span class="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
							Brak wykrytej wersji
						</span>
					{/if}
					
					{#if isValidFormat}
						<span class="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
							<Check class="mr-1 h-3 w-3" /> Szablon poprawny
						</span>
					{:else}
						<span class="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
							<Warning class="mr-1 h-3 w-3" /> Wymagane: blokserwis-x.x.x.apk
						</span>
					{/if}
				</div>
			</div>

			<TagsInput bind:value={tags} label="Tags" placeholder="Add version tags..." />

			<div class="space-y-1.5">
				<label for="notes" class="block text-sm font-medium text-text-muted">Notes</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Release notes, changelog..."
					rows="3"
					class="w-full rounded-md border border-border-line bg-transparent px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
				></textarea>
			</div>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Cancel</Button>
				<Button type="submit" disabled={(!!existingRelease && !overwrite) || !isValidFormat}>Upload</Button>
			</div>
		</form>
	</Card>
</div>
