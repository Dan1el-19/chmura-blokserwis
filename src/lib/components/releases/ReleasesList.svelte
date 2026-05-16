<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { PencilSimple, Trash, AndroidLogo, ArrowsClockwise, DownloadSimple } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import type { ParsedRelease } from '$lib/types/releases';

	type Props = {
		releases: ParsedRelease[];
		onEdit: (release: ParsedRelease) => void;
		onDelete: (release: ParsedRelease) => void;
		onForceSync: (release: ParsedRelease) => void;
		onDownload: (release: ParsedRelease) => void;
	};

	let { releases, onEdit, onDelete, onForceSync, onDownload }: Props = $props();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('pl-PL', {
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
		<p class="text-text-muted">Brak wydań</p>
		<p class="mt-1 text-sm text-text-muted/70">Prześlij pierwszy plik APK, aby rozpocząć</p>
	</div>
{:else}
	<div class="overflow-hidden rounded-md border border-border-line">
		<table class="w-full text-sm">
			<thead class="border-b border-border-line bg-gray-50 dark:bg-zinc-800/50">
				<tr>
					<th class="px-4 py-3 text-left font-medium text-text-muted">Nazwa</th>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted sm:table-cell"
						>Rozmiar</th
					>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted md:table-cell">Tagi</th>
					<th class="hidden px-4 py-3 text-left font-medium text-text-muted lg:table-cell"
						>Przesłano</th
					>
					<th class="px-4 py-3 text-right font-medium text-text-muted">Akcje</th>
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
									<p class="text-xs text-text-muted sm:hidden">{formatFileSize(release.size)}</p>
								</div>
							</div>
						</td>
						<td class="hidden px-4 py-3 text-text-muted sm:table-cell">
							{formatFileSize(release.size)}
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
									onclick={() => onDownload(release)}
									title="Pobierz"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => onForceSync(release)}
									title="Wymuś synchronizację"
								>
									<ArrowsClockwise class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => onEdit(release)} title="Edytuj">
									<PencilSimple class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => onDelete(release)} title="Usuń">
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
