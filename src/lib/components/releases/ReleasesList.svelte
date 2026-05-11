<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import {
		DownloadSimple,
		PencilSimple,
		Trash,
		AndroidLogo,
		ArrowsClockwise
	} from 'phosphor-svelte';
	import type { ParsedRelease } from '$lib/types/releases';

	type Props = {
		releases: ParsedRelease[];
		onEdit: (release: ParsedRelease) => void;
		onDelete: (release: ParsedRelease) => void;
		onDownload: (release: ParsedRelease) => void;
		onForceSync: (release: ParsedRelease) => void;
	};

	let { releases, onEdit, onDelete, onDownload, onForceSync }: Props = $props();

	function formatSize(bytes: number): string {
		if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
		if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
		if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${bytes} B`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#if releases.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-center">
		<AndroidLogo class="mb-4 h-12 w-12 text-text-muted/50" />
		<p class="text-text-muted">No releases yet</p>
		<p class="mt-1 text-sm text-text-muted/70">Upload your first APK to get started</p>
	</div>
{:else}
	<div class="overflow-hidden rounded-md border border-border-line">
		<table class="w-full text-sm">
			<thead class="border-b border-border-line bg-gray-50 dark:bg-zinc-800/50">
				<tr>
					<th class="px-4 py-3 text-left font-medium text-text-muted">Name</th>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted sm:table-cell">Size</th>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted md:table-cell">Tags</th>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted lg:table-cell"
						>Uploaded</th
					>
					<th class="px-4 py-3 text-right font-medium text-text-muted">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-border-line">
				{#each releases as release}
					<tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<AndroidLogo class="h-5 w-5 shrink-0 text-green-500" weight="fill" />
								<div>
									<p class="font-medium text-text-main">{release.name}</p>
									<p class="text-xs text-text-muted sm:hidden">{formatSize(release.size)}</p>
								</div>
							</div>
						</td>
						<td class="hidden px-4 py-3 text-text-muted sm:table-cell">
							{formatSize(release.size)}
						</td>
						<td class="hidden px-4 py-3 md:table-cell">
							<div class="flex flex-wrap gap-1">
								{#each release.tags as tag}
									<span
										class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
									>
										{tag}
									</span>
								{:else}
									<span class="text-xs text-text-muted">—</span>
								{/each}
							</div>
						</td>
						<td class="hidden px-4 py-3 text-text-muted lg:table-cell">
							{formatDate(release.$createdAt)}
						</td>
						<td class="px-4 py-3">
							<div class="flex justify-end gap-1">
								<Button
									variant="ghost"
									size="icon"
									onclick={() => onForceSync(release)}
									title="Force Sync"
								>
									<ArrowsClockwise class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => onDownload(release)}
									title="Download"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => onEdit(release)} title="Edit">
									<PencilSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => onDelete(release)}
									title="Delete"
								>
									<Trash class="h-4 w-4 text-red-500" />
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
