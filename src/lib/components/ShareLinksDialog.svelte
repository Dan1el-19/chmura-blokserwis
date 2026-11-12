<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { create } from '@bufbuild/protobuf';
	import { FieldMaskSchema } from '@bufbuild/protobuf/wkt';
	import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
	import { Code, ConnectError } from '@connectrpc/connect';
	import { CopySimple, LinkSimple, SpinnerGap, Trash, X } from 'phosphor-svelte';
	import { shareLinks } from '#lib/api.js';
	import { resolve } from '$app/paths';
	import { storageErrorMessage } from '#lib/storage-error.js';
	import {
		EntryKind,
		CreateShareRequestSchema,
		ListSharesRequestSchema,
		RevokeShareRequestSchema,
		UpdateShareRequestSchema,
		type Entry,
		type ShareLink
	} from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
	import AppDialog from './AppDialog.svelte';

	let { file, spaceId, onclose }: { file: Entry; spaceId: string; onclose: () => void } = $props();
	let links = $state<ShareLink[]>([]);
	let slug = $state('');
	let labelInput = $state('');
	let passwordInput = $state('');
	let maxDownloadsInput = $state<string | number>('');
	let expiryInput = $state('');
	let editingId = $state('');
	let editLabel = $state('');
	let editPassword = $state('');
	let clearPassword = $state(false);
	let editMaxDownloads = $state<string | number>('');
	let editExpiry = $state('');
	let showCreate = $state(false);
	let loading = $state(true);
	let pending = $state(false);
	let error = $state('');
	let notice = $state('');
	let origin = $state('');
	let pendingCreateRequestId = '';
	let requestVersion = 0;
	const titleId = $derived(`share-title-${file.id}`);
	const previewUrl = $derived(`${origin}/s/${encodeURIComponent(slug.trim() || 'moj-link')}`);

	function sharePath(address: string, download = false): string {
		const path = download
			? resolve('/s/[address]/download', { address })
			: resolve('/s/[address]', { address });
		return path.replace('[address]', encodeURIComponent(address));
	}

	function message(cause: unknown): string {
		if (cause instanceof ConnectError && cause.code === Code.AlreadyExists) return 'Ten adres jest już zajęty. Wybierz inny adres.';
		if (cause instanceof ConnectError && cause.code === Code.InvalidArgument) return 'Własny adres musi mieć 3–64 znaki: małe litery, cyfry i myślniki; początek i koniec muszą być literą lub cyfrą.';
		return storageErrorMessage(cause);
	}

	async function loadLinks(): Promise<void> {
		const version = ++requestVersion;
		loading = true;
		error = '';
		try {
			const result = await shareLinks.listShares(create(ListSharesRequestSchema, { spaceId, entryId: file.id }));
			if (version === requestVersion) links = result.shares;
		} catch (cause) {
			if (version === requestVersion) error = message(cause);
		} finally {
			if (version === requestVersion) loading = false;
		}
	}

	function urlFor(address: string, download = false): string {
		const path = sharePath(address, download);
		return new URL(path, window.location.origin).toString();
	}

	function statusFor(link: ShareLink): 'active' | 'expired' | 'revoked' | 'limit' | 'paused' {
		if (link.revokedAt) return 'revoked';
		if (link.paused) return 'paused';
		if (link.expiresAt && timestampDate(link.expiresAt).getTime() <= Date.now()) return 'expired';
		if (link.maxDownloads !== undefined && link.downloadCount >= link.maxDownloads) return 'limit';
		return 'active';
	}

	function expiryLabel(link: ShareLink): string {
		if (link.revokedAt) return 'Unieważniony';
		if (!link.expiresAt) return 'Bez terminu';
		const expires = timestampDate(link.expiresAt);
		return expires.getTime() <= Date.now() ? `Wygasł ${expires.toLocaleString('pl-PL')}` : `Wygasa ${expires.toLocaleString('pl-PL')}`;
	}

	async function copy(address: string, download = false): Promise<void> {
		try {
			await navigator.clipboard.writeText(urlFor(address, download));
			notice = download ? 'Skopiowano link do pobrania.' : 'Skopiowano link.';
			error = '';
		} catch (cause) {
			error = `Nie udało się skopiować linku: ${message(cause)}`;
		}
	}

	async function createLink(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (pending) return;
		pending = true;
		error = '';
		notice = '';
		try {
			const maxDownloadsText = String(maxDownloadsInput).trim();
			const maxDownloads = maxDownloadsText ? Number(maxDownloadsText) : undefined;
			if (maxDownloads !== undefined && (!Number.isSafeInteger(maxDownloads) || maxDownloads <= 0)) {
				error = 'Limit pobrań musi być dodatnią liczbą całkowitą.';
				return;
			}
			const expiresAt = expiryInput ? new Date(expiryInput) : undefined;
			const requestId = pendingCreateRequestId || crypto.randomUUID();
			pendingCreateRequestId = requestId;
			const result = await shareLinks.createShare(create(CreateShareRequestSchema, {
				spaceId,
				entryId: file.id,
				requestId,
				...(slug.trim() ? { slug: slug.trim() } : {}),
				...(labelInput.trim() ? { label: labelInput.trim() } : {}),
				...(passwordInput ? { password: passwordInput } : {}),
				...(maxDownloads === undefined ? {} : { maxDownloads: BigInt(maxDownloads) }),
				...(expiresAt && !Number.isNaN(expiresAt.getTime()) ? { expiresAt: timestampFromDate(expiresAt) } : {})
			}));
			if (result.share) {
				links = [result.share, ...links];
				slug = '';
				labelInput = '';
				passwordInput = '';
				maxDownloadsInput = '';
				expiryInput = '';
				pendingCreateRequestId = '';
				notice = 'Link został utworzony.';
				showCreate = false;
				await tick();
				document.getElementById(`share-result-${result.share.id}`)?.focus();
			}
		} catch (cause) {
			error = message(cause);
		} finally {
			pending = false;
		}
	}

	function startEditing(link: ShareLink): void {
		editingId = link.id;
		editLabel = link.label ?? '';
		editPassword = '';
		clearPassword = false;
		editMaxDownloads = link.maxDownloads?.toString() ?? '';
		editExpiry = link.expiresAt ? new Date(timestampDate(link.expiresAt).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
	}

	async function saveEdit(link: ShareLink, event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (pending || editingId !== link.id) return;
		const maxDownloadsText = String(editMaxDownloads).trim();
		const maxDownloads = maxDownloadsText ? Number(maxDownloadsText) : undefined;
		if (maxDownloads !== undefined && (!Number.isSafeInteger(maxDownloads) || maxDownloads <= 0)) {
			error = 'Limit pobrań musi być dodatnią liczbą całkowitą.';
			return;
		}
		const paths = ['label', 'expiresAt', 'maxDownloads'];
		if (editPassword || clearPassword) paths.push('password');
		const expiresAt = editExpiry ? new Date(editExpiry) : undefined;
		pending = true;
		error = '';
		notice = '';
		try {
			const result = await shareLinks.updateShare(create(UpdateShareRequestSchema, {
				spaceId,
				shareId: link.id,
				expectedRevision: link.revision,
				updateMask: create(FieldMaskSchema, { paths }),
				label: editLabel,
				maxDownloads: maxDownloads === undefined ? 0n : BigInt(maxDownloads),
				...(expiresAt && !Number.isNaN(expiresAt.getTime()) ? { expiresAt: timestampFromDate(expiresAt) } : {}),
				...(editPassword ? { password: editPassword } : clearPassword ? { password: '' } : {})
			}));
			if (result.share) links = links.map((item) => item.id === link.id ? result.share! : item);
			editingId = '';
			notice = 'Ustawienia linku zostały zapisane. Adres pozostał bez zmian.';
		} catch (cause) {
			error = cause instanceof ConnectError && cause.code === Code.Aborted
				? 'Ktoś zmienił ustawienia tego linku. Odśwież listę i spróbuj ponownie.'
				: message(cause);
		} finally {
			pending = false;
		}
	}

	async function revoke(link: ShareLink): Promise<void> {
		const status = statusFor(link);
		if (pending || (status !== 'active' && status !== 'limit')) return;
		pending = true;
		error = '';
		notice = '';
		try {
			const result = await shareLinks.revokeShare(create(RevokeShareRequestSchema, { spaceId, shareId: link.id }));
			if (result.share) links = links.map((item) => item.id === link.id ? result.share! : item);
			notice = 'Link został unieważniony.';
		} catch (cause) {
			error = message(cause);
		} finally {
			pending = false;
		}
	}

	onMount(() => {
		origin = window.location.origin;
		void loadLinks();
		return () => { requestVersion++; };
	});
</script>

<AppDialog labelledby={titleId} busy={pending} wide onclose={onclose}>
	<section class="space-y-5">
		<header class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<h2 id={titleId} class="text-base font-semibold text-text-main">{file.kind === EntryKind.FOLDER ? 'Udostępnij folder' : 'Udostępnij plik'}</h2>
				<p class="mt-1 truncate text-xs text-text-muted">{file.name}</p>
			</div>
			<button type="button" onclick={onclose} disabled={pending} class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Zamknij udostępnianie"><X class="h-5 w-5" /></button>
		</header>

		{#if notice}<p class="text-sm text-emerald-700 dark:text-emerald-300" role="status">{notice}</p>{/if}
		{#if error}<p class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>{/if}

		<div>
			<h3 class="mb-2 text-sm font-semibold text-text-main">{file.kind === EntryKind.FOLDER ? 'Linki do folderu' : 'Linki do pliku'}</h3>
			{#if loading}<p class="flex items-center gap-2 py-5 text-sm text-text-muted" role="status"><SpinnerGap class="h-4 w-4 animate-spin" />Ładowanie linków…</p>
			{:else if !links.length}<p class="rounded-md border border-dashed border-border-line px-4 py-6 text-center text-sm text-text-muted">Nie utworzono jeszcze linków.</p>
			{:else}<ul class="max-h-[55dvh] space-y-2 overflow-y-auto">
				{#each links as link (link.id)}
					{@const status = statusFor(link)}
					<li id={`share-result-${link.id}`} tabindex="-1" class="rounded-md border border-border-line p-3 {status === 'active' || status === 'limit' ? 'bg-bg-panel' : 'bg-bg-app opacity-75'}">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">{#if status === 'active' || status === 'limit'}<a class="block truncate font-mono text-sm text-primary hover:underline" href={resolve('/s/[address]', { address: link.address })} target="_blank" rel="noreferrer">{urlFor(link.address)}</a>{:else}<span class="block truncate font-mono text-sm text-text-muted">{urlFor(link.address)}</span>{/if}<p class="mt-1 break-words text-sm font-medium text-text-main">{link.label || 'Bez etykiety'}</p><p class="mt-1 text-xs text-text-muted">{status === 'active' ? 'Aktywny' : status === 'expired' ? 'Wygasły' : status === 'limit' ? 'Limit wyczerpany' : status === 'paused' ? 'Wstrzymany' : 'Unieważniony'} · {expiryLabel(link)}</p><p class="mt-1 text-xs text-text-muted">Wejścia: {link.viewCount.toString()} · Pobrania: {link.downloadCount.toString()}{link.maxDownloads === undefined ? '' : ` / ${link.maxDownloads.toString()}`} · {link.hasPassword ? 'Chroniony hasłem' : 'Bez hasła'}</p></div>
							{#if status === 'active' || status === 'limit'}<div class="flex shrink-0 flex-wrap gap-1">
								<button type="button" onclick={() => void copy(link.address)} class="inline-flex items-center gap-1.5 rounded border border-border-line px-2.5 py-2 text-xs font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"><CopySimple class="h-3.5 w-3.5" />Kopiuj link</button>
								{#if file.kind === EntryKind.FILE}<button type="button" onclick={() => void copy(link.address, true)} class="inline-flex items-center gap-1.5 rounded border border-border-line px-2.5 py-2 text-xs font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"><CopySimple class="h-3.5 w-3.5" />Kopiuj pobieranie</button>{/if}
								<button type="button" disabled={pending} onclick={() => editingId === link.id ? editingId = '' : startEditing(link)} class="inline-flex items-center gap-1.5 rounded border border-border-line px-2.5 py-2 text-xs font-medium text-text-main hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800">{editingId === link.id ? 'Zamknij edycję' : 'Edytuj'}</button>
								<button type="button" disabled={pending} onclick={() => void revoke(link)} class="inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"><Trash class="h-3.5 w-3.5" />Unieważnij</button>
							</div>{/if}
						</div>
						{#if editingId === link.id}<form onsubmit={(event) => void saveEdit(link, event)} class="mt-4 grid gap-3 border-t border-border-line pt-4 md:grid-cols-2">
							<label class="space-y-1.5 text-sm"><span>Etykieta</span><input bind:value={editLabel} maxlength="200" disabled={pending} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm" /></label>
							<label class="space-y-1.5 text-sm"><span>Nowe hasło</span><input type="password" bind:value={editPassword} autocomplete="new-password" maxlength="256" disabled={pending || clearPassword} placeholder={link.hasPassword ? 'Pozostaw puste, aby nie zmieniać' : 'Pozostaw puste, aby pozostać bez hasła'} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm" />{#if link.hasPassword}<span class="flex items-center gap-2 text-xs"><input type="checkbox" bind:checked={clearPassword} disabled={pending} />Usuń obecne hasło</span>{/if}</label>
							<label class="space-y-1.5 text-sm"><span>Limit pobrań</span><input type="number" min="1" step="1" bind:value={editMaxDownloads} disabled={pending} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm" /><span class="block text-xs text-text-muted">Puste pole usuwa limit.</span></label>
							<label class="space-y-1.5 text-sm"><span>Termin ważności</span><input type="datetime-local" bind:value={editExpiry} disabled={pending} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm" /><span class="block text-xs text-text-muted">Puste pole usuwa termin.</span></label>
							<div class="flex justify-end gap-2 md:col-span-2"><button type="button" onclick={() => (editingId = '')} disabled={pending} class="min-h-10 rounded-md border border-border-line px-4 text-sm">Anuluj</button><button type="submit" disabled={pending} class="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white disabled:opacity-50">{#if pending}<SpinnerGap class="h-4 w-4 animate-spin" />{/if}Zapisz ustawienia</button></div>
						</form>{/if}
					</li>
				{/each}
			</ul>{/if}
		</div>
		<div>
			{#if !links.length && !loading}<p class="mb-2 text-sm text-text-muted">Domyślnie link nie ma hasła, terminu ani limitu pobrań.</p>{/if}
			<button type="button" disabled={loading || pending} class="min-h-11 rounded-md border border-border-line px-4 text-sm font-medium disabled:opacity-50" onclick={() => showCreate = !showCreate}>{showCreate ? 'Zamknij formularz' : links.length ? 'Utwórz kolejny link' : 'Utwórz link'}</button>
		</div>
		{#if showCreate}
			<form onsubmit={createLink} class="grid gap-3 rounded-md border border-border-line bg-bg-app p-4 md:grid-cols-2">
				<label class="block space-y-1.5 text-sm text-text-main"><span>Etykieta <span class="font-normal text-text-muted">(opcjonalnie)</span></span><input bind:value={labelInput} oninput={() => pendingCreateRequestId = ''} maxlength="200" placeholder="np. Dla klienta X" disabled={pending} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none" /></label>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Własny adres linku <span class="font-normal text-text-muted">(opcjonalnie)</span></span><input bind:value={slug} oninput={() => pendingCreateRequestId = ''} maxlength="64" autocomplete="off" placeholder="np. moje-zdjecie" disabled={pending} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none" /><span class="block text-xs text-text-muted">Małe litery a–z, cyfry i myślniki. {previewUrl}</span></label>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Hasło <span class="font-normal text-text-muted">(opcjonalnie)</span></span><input type="password" bind:value={passwordInput} oninput={() => pendingCreateRequestId = ''} autocomplete="new-password" maxlength="256" disabled={pending} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none" /></label>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Limit pobrań <span class="font-normal text-text-muted">(opcjonalnie)</span></span><input type="number" min="1" step="1" bind:value={maxDownloadsInput} oninput={() => pendingCreateRequestId = ''} disabled={pending} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none" /><span class="block text-xs text-text-muted">Puste pole oznacza brak limitu.</span></label>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Termin ważności</span><input type="datetime-local" bind:value={expiryInput} oninput={() => pendingCreateRequestId = ''} disabled={pending} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none" /><span class="block text-xs text-text-muted">Puste pole oznacza link bezterminowy.</span></label>
				<div class="flex items-end"><button type="submit" disabled={pending} class="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{#if pending}<SpinnerGap class="h-4 w-4 animate-spin" />{:else}<LinkSimple class="h-4 w-4" />{/if}Utwórz link</button></div>
			</form>
		{/if}
	</section>
</AppDialog>
