<script lang="ts">
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import { StorageLocation, type Entry } from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
	import AppDialog from '../AppDialog.svelte';
	let { entry, path, onclose }: { entry: Entry; path: string; onclose: () => void } = $props();
	const titleId = $props.id();
	function date(value: Entry['createdAt']): string {
		return value ? timestampDate(value).toLocaleDateString('pl-PL') : '—';
	}
	const provider = $derived(entry.storageLocation === StorageLocation.R2 ? 'R2' : entry.storageLocation === StorageLocation.RUSTFS ? 'RustFS' : '—');
</script>

<AppDialog labelledby={titleId} {onclose}>
	<h2 id={titleId} class="text-lg font-semibold">Szczegóły</h2>
	<dl class="mt-4 space-y-3 text-sm">
		<div><dt class="text-text-muted">Nazwa</dt><dd class="break-words">{entry.name}</dd></div>
		<div><dt class="text-text-muted">Ścieżka</dt><dd class="break-words">{path}</dd></div>
		<div><dt class="text-text-muted">Utworzono</dt><dd>{date(entry.createdAt)}</dd></div>
		<div><dt class="text-text-muted">Zmodyfikowano</dt><dd>{date(entry.modifiedAt)}</dd></div>
		<div><dt class="text-text-muted">Magazyn</dt><dd>{provider}</dd></div>
	</dl>
	<button type="button" class="mt-5 min-h-11 rounded-md border border-border-line px-4 text-sm" onclick={onclose}>Zamknij</button>
</AppDialog>
