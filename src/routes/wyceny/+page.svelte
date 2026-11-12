<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Code, ConnectError } from '@connectrpc/connect';
	import { AUTH_CONTEXT, type AuthContext } from '#lib/auth-context.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getQuoteClient } from '#lib/api.js';
	import { QuotePriceMode, type Quote } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, panel, primary, quoteError } from '#lib/quotes/ui.js';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';

	let items = $state<Quote[]>([]);
	let archived = $state(false);
	let offset = $state(0);
	let loading = $state(true);
	let creating = $state(false);
	let error = $state('');
	let denied = $state(false);
	const auth = getContext<AuthContext>(AUTH_CONTEXT);
	const authState = auth.state;
	let request = 0;
	let createKey = '';

	async function load(nextOffset = 0, archive = archived) {
		const current = ++request;
		loading = true;
		error = '';
		denied = false;
		try {
			const result = await getQuoteClient().listQuotes({ archived: archive, pageOffset: nextOffset, pageSize: 20 });
			if (current !== request) return;
			items = result.quotes;
			archived = archive;
			offset = nextOffset;
		} catch (reason) {
			if (current === request) {
				denied = reason instanceof ConnectError && reason.code === Code.PermissionDenied;
				error = quoteError(reason);
			}
		} finally {
			if (current === request) loading = false;
		}
	}

	async function createQuote() {
		creating = true;
		error = '';
		try {
			createKey ||= crypto.randomUUID();
			const result = await getQuoteClient().createQuote({
				idempotencyKey: createKey,
				draft: { title: 'Nowa wycena', priceMode: QuotePriceMode.GROSS }
			});
			if (!result.quote) throw new Error('Nie otrzymano identyfikatora szkicu.');
			await goto(resolve('/wyceny/[id]', { id: result.quote.id }));
		} catch (reason) {
			error = quoteError(reason);
		} finally {
			creating = false;
		}
	}

	async function activateOrganization(organization: string) {
		try { await auth.selectOrganization(organization); await load(); }
		catch (reason) { error = quoteError(reason); }
	}

	onMount(() => { void load(); });
</script>

<section class="mx-auto max-w-5xl space-y-4">
	<PageHeader title="Wyceny">
		{#snippet actions()}
		<button type="button" class={primary} disabled={creating} onclick={createQuote}>Nowa wycena</button>
		{/snippet}
	</PageHeader>
	<div class="flex gap-2">
		<button type="button" class={button} disabled={loading} aria-pressed={!archived} onclick={() => load(0, false)}>Aktywne</button>
		<button type="button" class={button} disabled={loading} aria-pressed={archived} onclick={() => load(0, true)}>Archiwum</button>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
	{#if denied}
		<div class="flex flex-wrap gap-2">
			{#each $authState.user?.organizationMemberships ?? [] as membership (membership.organization.id)}
				<button class={button} onclick={() => activateOrganization(membership.organization.id)}>Wybierz {membership.organization.name}</button>
			{/each}
		</div>
	{/if}
	<div class={panel}>
		{#if loading}
			<p role="status">Wczytywanie wycen…</p>
		{:else if items.length === 0}
			<p>Brak wycen na tej stronie.</p>
		{:else}
			<ul class="divide-y divide-border-line">
				{#each items as item (item.id)}
					<li>
						<a class="block rounded px-2 py-3 hover:bg-bg-app" href={resolve('/wyceny/[id]', { id: item.id })}>
							<span class="font-semibold">{item.draft?.title || 'Wycena'}</span>
							<span class="ml-2 text-sm text-text-muted">{item.number || 'Szkic'}{item.draft?.client ? ` · ${item.draft.client}` : ''}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex gap-2">
			{#if offset > 0}<button class={button} disabled={loading} onclick={() => load(offset - 20)}>Poprzednia</button>{/if}
			{#if items.length === 20}<button class={button} disabled={loading} onclick={() => load(offset + 20)}>Następna</button>{/if}
		</div>
	</div>
</section>
