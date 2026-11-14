<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { catalog } from '#lib/api.js';
	import { getCloudState } from '#lib/cloud-state.svelte.js';
	import { EntryKind, GetEntryRequestSchema, SpaceKind } from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
	import StoragePage from '#lib/components/StoragePage.svelte';

	const app = getCloudState();
	let checking = $state(false);
	let generation = 0;

	$effect(() => {
		const url = page.url;
		const folder = url.searchParams.get('folder');
		const current = ++generation;
		if (!folder) {
			checking = false;
			return;
		}
		checking = true;
		void (async () => {
			await app.ensureAccount();
			const personal = app.spaces.find((space) => space.kind === SpaceKind.PRIVATE);
			if (personal) {
				try {
					const result = await catalog.getEntry(create(GetEntryRequestSchema, { spaceId: personal.id, entryId: folder }));
					if (current !== generation) return;
					if (result.entry?.kind === EntryKind.FOLDER && result.entry.spaceId === personal.id) {
						await goto(resolve(`/personal${url.search}${url.hash}` as `/personal?${string}`), { replaceState: true });
						return;
					}
				} catch {
					// The folder may belong to Main or no longer exist.
				}
			}
			if (current === generation) checking = false;
		})();
		return () => { generation++; };
	});
</script>

{#if !checking}<StoragePage spaceKind="shared" />{/if}
