<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { onMount } from 'svelte';
	import { FieldMaskSchema, timestampDate } from '@bufbuild/protobuf/wkt';
	import { shareLinks } from '#lib/api.js';
	import { getCloudState } from '#lib/cloud-state.svelte.js';
	import { storageErrorMessage } from '#lib/storage-error.js';
	import { resolve } from '$app/paths';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import { DeleteShareRequestSchema, EntryKind, ListSpaceSharesRequestSchema, SpaceKind, UpdateShareRequestSchema, type SpaceShare } from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';

	const app = getCloudState();
	onMount(() => { void app.ensureAccount(); });
	let spaceId = $state('');
	let items = $state<SpaceShare[]>([]);
	let next = $state('');
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let editingId = $state('');
	let slug = $state('');
	let generation = 0;
	$effect(() => {
		if (app.accountReady && !spaceId) spaceId = app.spaces.find(space => space.kind === SpaceKind.SHARED)?.id ?? '';
	});
	$effect(() => {
		const selected = spaceId;
		const current = ++generation;
		items = [];
		next = '';
		notice = '';
		if (selected) void load(selected, '', current);
		return () => { generation++; };
	});
	async function load(selected: string, token = '', current = generation): Promise<void> {
		busy = true;
		error = '';
		try {
			const result = await shareLinks.listSpaceShares(create(ListSpaceSharesRequestSchema, {spaceId:selected,pageSize:50,pageToken:token}));
			if (current !== generation) return;
			items = token ? [...items, ...result.shares] : result.shares;
			next = result.nextPageToken;
		} catch (cause) { if (current === generation) error = storageErrorMessage(cause); }
		finally { if (current === generation) busy = false; }
	}
	async function update(item: SpaceShare, changes: {paused?: boolean; slug?: string}): Promise<void> {
		if (!item.share || busy) return;
		const selected = spaceId, current = generation;
		busy = true;
		error = '';
		notice = '';
		try {
			const response = await shareLinks.updateShare(create(UpdateShareRequestSchema, {
				spaceId:selected,shareId:item.share.id,expectedRevision:item.share.revision,
				updateMask:create(FieldMaskSchema,{paths:Object.keys(changes)}),...changes
			}));
			if (current !== generation) return;
			if (!response.share) throw new Error('Usługa nie potwierdziła zmian linku.');
			item.share = response.share;
			editingId = '';
			notice = changes.paused === true ? 'Link został wstrzymany.' : changes.paused === false ? 'Link został wznowiony.' : 'Adres linku został zapisany.';
		} catch (cause) { if (current === generation) error = storageErrorMessage(cause); }
		finally { if (current === generation) busy = false; }
	}
	async function remove(item: SpaceShare): Promise<void> {
		if (!item.share || busy || !confirm(`Usunąć link do „${item.entryName || 'elementu'}”?`)) return;
		const selected = spaceId, current = generation;
		busy = true;
		error = '';
		notice = '';
		try {
			await shareLinks.deleteShare(create(DeleteShareRequestSchema,{spaceId:selected,shareId:item.share.id,expectedRevision:item.share.revision}));
			if (current === generation) { items = items.filter(value => value.share?.id !== item.share?.id); notice = 'Link został usunięty.'; }
		} catch (cause) { if (current === generation) error = storageErrorMessage(cause); }
		finally { if (current === generation) busy = false; }
	}
	function linkState(item: SpaceShare): string {
		const share = item.share;
		if (!share) return 'Niedostępny';
		if (share.revokedAt) return 'Unieważniony';
		if (share.paused) return 'Wstrzymany';
		if (share.expiresAt && timestampDate(share.expiresAt).getTime() <= Date.now()) return 'Wygasły';
		if (share.maxDownloads !== undefined && share.downloadCount >= share.maxDownloads) return 'Limit pobrań';
		return 'Aktywny';
	}
	async function copyLink(item: SpaceShare, download = false): Promise<void> {
		if (!item.share) return;
		try {
			const path = download ? resolve('/s/[address]/download', { address: item.share.address }) : resolve('/s/[address]', { address: item.share.address });
			await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
			error = '';
			notice = download ? 'Skopiowano adres pobierania.' : 'Skopiowano link.';
		} catch (cause) {
			notice = '';
			error = `Nie udało się skopiować linku: ${storageErrorMessage(cause)}`;
		}
	}
</script>

<section class="space-y-5">
	<PageHeader title="Udostępnienia" description="Linki i statystyki wybranej przestrzeni.">
		{#snippet actions()}
			<label class="text-sm">Przestrzeń <select bind:value={spaceId} class="ml-2 rounded-md border border-border-line bg-bg-panel p-2">{#each app.spaces as space (space.id)}<option value={space.id}>{space.kind === SpaceKind.SHARED ? 'Pliki wspólne' : 'Pliki prywatne'}</option>{/each}</select></label>
		{/snippet}
	</PageHeader>
	{#if error || app.accountError}<p role="alert" class="rounded-md bg-red-500/10 p-3 text-sm text-red-600">{error || app.accountError}</p>{/if}
	{#if notice}<p role="status" class="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>{/if}
	{#if !items.length && !busy}<p class="rounded-md border border-border-line p-6 text-sm text-text-muted">Brak linków w tej przestrzeni.</p>{/if}
	<div class="space-y-3">
		{#each items as item (item.share?.id)}
			{#if item.share}
				<article class="space-y-3 rounded-md border border-border-line bg-bg-panel p-4">
					<div class="flex flex-wrap justify-between gap-2"><div><strong class="break-all">{item.entryName || 'Element niedostępny'}</strong><p class="text-xs text-text-muted">{linkState(item)} · {item.share.viewCount} wyświetleń · {item.share.downloadCount}{item.share.maxDownloads === undefined ? '' : ` / ${item.share.maxDownloads}`} pobrań</p></div><span class="text-sm text-text-muted">{item.share.hasPassword ? 'Hasło' : 'Bez hasła'}</span></div>
					<p class="break-all text-sm">/s/{item.share.address}</p>
					{#if editingId === item.share.id}
						<form class="flex flex-wrap gap-2" onsubmit={(event) => {event.preventDefault(); void update(item,{slug});}}><label class="sr-only" for="slug-{item.share.id}">Nowy adres</label><input id="slug-{item.share.id}" bind:value={slug} required pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])" minlength="3" maxlength="64" class="min-w-0 flex-1 rounded border border-border-line bg-bg-panel p-2 text-sm"/><button disabled={busy} class="rounded border border-border-line px-3 text-sm">Zapisz adres</button><button type="button" onclick={() => editingId = ''} class="px-2 text-sm">Anuluj</button></form>
					{/if}
					<div class="flex flex-wrap gap-2 text-sm">{#if linkState(item) === 'Aktywny' || linkState(item) === 'Limit pobrań'}<button type="button" class="rounded border border-border-line px-3 py-2" onclick={() => void copyLink(item)}>Kopiuj link</button>{#if item.entryKind === EntryKind.FILE}<button type="button" class="rounded border border-border-line px-3 py-2" onclick={() => void copyLink(item, true)}>Kopiuj adres pobierania</button>{/if}{/if}<button disabled={busy || !!item.share.revokedAt} class="rounded border border-border-line px-3 py-2 disabled:opacity-50" onclick={() => void update(item,{paused:!item.share!.paused})}>{item.share.paused ? 'Wznów' : 'Wstrzymaj'}</button><button disabled={busy || !!item.share.revokedAt} class="rounded border border-border-line px-3 py-2 disabled:opacity-50" onclick={() => {editingId=item.share!.id;slug=item.share!.address;}}>Zmień adres</button><button disabled={busy} class="rounded px-3 py-2 text-red-600 disabled:opacity-50" onclick={() => void remove(item)}>Usuń link</button></div>
				</article>
			{/if}
		{/each}
	</div>
	{#if next}<button disabled={busy} class="rounded border border-border-line px-4 py-2 text-sm" onclick={() => void load(spaceId,next)}>Pokaż więcej</button>{/if}
</section>
