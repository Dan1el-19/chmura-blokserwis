<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { toast } from 'svelte-sonner';
	import { Copy, Trash, Plus, Globe, Clock, X, Lock, Hash, PencilSimple } from 'phosphor-svelte';
	import DateTimePicker from '$lib/components/ui/DateTimePicker.svelte';
	import type { FileShare } from '$lib/types/storage';
	import { onMount } from 'svelte';

	interface Props {
		fileId: string;
		onClose: () => void;
	}

	let { fileId, onClose }: Props = $props();

	let shares = $state<FileShare[]>([]);
	let loading = $state(false);
	let creating = $state(false);
	let updatingShareId = $state<string | null>(null);
	let editingShareId = $state<string | null>(null);

	// Form State
	let label = $state('');
	let customSlug = $state('');
	let expiresAt = $state('');
	let slugError = $state('');
	let password = $state('');
	let maxDownloads = $state<number | null>(null);
	let editLabel = $state('');
	let editExpiresAt = $state('');
	let editPassword = $state('');
	let editRemovePassword = $state(false);
	let editMaxDownloads = $state<number | null>(null);

	async function loadShares() {
		loading = true;
		try {
			const res = await fetch(`/api/shares?fileId=${fileId}`);
			if (res.ok) {
				shares = await res.json();
			} else {
				toast.error('Nie udało się załadować linków');
			}
		} catch (e) {
			toast.error('Błąd sieci');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadShares();
	});

	function validateSlug(value: string): boolean {
		if (!value) return true;
		const valid = /^[a-z0-9-]+$/.test(value);
		slugError = valid ? '' : 'Tylko małe litery, cyfry i myślniki';
		return valid;
	}

	async function handleCreate(e: Event) {
		e.preventDefault();
		if (!validateSlug(customSlug)) return;
		creating = true;

		try {
			const res = await fetch('/api/shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileId,
					label,
					expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
					customSlug: customSlug || undefined,
					password: password || undefined,
					maxDownloads: maxDownloads || undefined
				})
			});

			if (res.ok) {
				toast.success('Link utworzony');
				await loadShares();
				label = '';
				customSlug = '';
				expiresAt = '';
				password = '';
				maxDownloads = null;
			} else {
				const err = await res.json();
				toast.error(err.error || 'Nie udało się utworzyć linku');
			}
		} catch (e) {
			toast.error('Nie udało się utworzyć linku');
		} finally {
			creating = false;
		}
	}

	async function handleDelete(shareId: string) {
		if (!confirm('Czy na pewno chcesz usunąć ten link?')) return;
		try {
			const res = await fetch(`/api/shares/${shareId}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Link usunięty');
				shares = shares.filter((s) => s.$id !== shareId);
			} else {
				toast.error('Nie udało się usunąć');
			}
		} catch (e) {
			toast.error('Błąd podczas usuwania');
		}
	}

	function handleEditStart(share: FileShare) {
		editingShareId = share.$id;
		editLabel = share.label ?? '';
		editExpiresAt = share.expiresAt ?? '';
		editPassword = '';
		editRemovePassword = false;
		editMaxDownloads = share.maxDownloads;
	}

	function handleEditCancel() {
		editingShareId = null;
		editLabel = '';
		editExpiresAt = '';
		editPassword = '';
		editRemovePassword = false;
		editMaxDownloads = null;
	}

	async function handleUpdate(e: Event, shareId: string) {
		e.preventDefault();
		updatingShareId = shareId;

		try {
			const passwordUpdate = editRemovePassword
				? { password: null }
				: editPassword
					? { password: editPassword }
					: {};
			const res = await fetch(`/api/shares/${shareId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					label: editLabel,
					expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
					maxDownloads: editMaxDownloads || null,
					...passwordUpdate
				})
			});

			if (res.ok) {
				const updated = await res.json();
				shares = shares.map((share) => (share.$id === shareId ? updated : share));
				toast.success('Ustawienia linku zapisane');
				handleEditCancel();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Nie udało się zapisać linku');
			}
		} catch (e) {
			toast.error('Nie udało się zapisać linku');
		} finally {
			updatingShareId = null;
		}
	}

	function getFullUrl(token: string) {
		return `${window.location.origin}/file/${token}`;
	}

	function copyLink(token: string) {
		navigator.clipboard.writeText(getFullUrl(token));
		toast.success('Link skopiowany do schowka');
	}

	function formatExpiry(dateStr: string | null) {
		if (!dateStr) return 'Bez wygaśnięcia';
		return new Date(dateStr).toLocaleString('pl-PL');
	}

	function getShareTypeBadge() {
		return { label: 'Plik', class: 'bg-blue-500/10 text-blue-600' };
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="share-dialog-title"
>
	<div
		class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-line bg-bg-panel shadow-lg"
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border-line/50 px-6 py-4">
			<h3
				id="share-dialog-title"
				class="text-sm leading-none font-semibold tracking-tight text-text-main"
			>
				Udostępnij plik
			</h3>
			<button
				onclick={onClose}
				class="rounded-md p-1 text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800"
				title="Zamknij"
			>
				<X size={20} />
			</button>
		</div>

		<div class="space-y-6 overflow-y-auto p-4">
			<!-- Create New Share -->
			<div
				class="space-y-4 rounded-lg border border-border-line bg-gray-50 p-4 dark:bg-zinc-900/50"
			>
				<h4 class="flex items-center gap-2 text-sm font-medium">
					<Plus size={16} /> Utwórz nowy link
				</h4>

				<form onsubmit={handleCreate} class="space-y-4" autocomplete="off">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input
							label="Etykieta (opcjonalne)"
							placeholder="np. Dla klienta X"
							bind:value={label}
							autocomplete="off"
							name="share_label"
						/>
						<div>
							<Input
								label="Własny slug URL (opcjonalne)"
								placeholder="moj-link-do-pliku"
								bind:value={customSlug}
								oninput={() => validateSlug(customSlug)}
								autocomplete="off"
								name="share_slug"
							/>
							{#if slugError}
								<p class="mt-1 text-xs text-red-500">{slugError}</p>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label for="password" class="mb-1.5 block text-sm font-medium text-text-main">
								<Lock size={14} class="mr-1 inline" />Hasło (opcjonalne)
							</label>
							<input
								type="password"
								id="password"
								placeholder="Zostaw puste = bez hasła"
								bind:value={password}
								autocomplete="new-password"
								name="share_password"
								class="w-full rounded-md border border-border-line bg-white px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:bg-zinc-900"
							/>
						</div>
						<div>
							<label for="maxDownloads" class="mb-1.5 block text-sm font-medium text-text-main">
								<Hash size={14} class="mr-1 inline" />Limit pobrań (opcjonalne)
							</label>
							<input
								type="number"
								id="maxDownloads"
								min="1"
								placeholder="np. 5"
								bind:value={maxDownloads}
								autocomplete="off"
								name="share_max_downloads"
								inputmode="numeric"
								class="w-full rounded-md border border-border-line bg-white px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:bg-zinc-900"
							/>
						</div>
					</div>

					<div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
						<DateTimePicker label="Wygasa" bind:value={expiresAt} onlyFutureDates={true} />

						<Button type="submit" loading={creating} size="sm">Utwórz link</Button>
					</div>
				</form>
			</div>

			<!-- Existing Shares -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-text-muted">Aktywne linki ({shares.length})</h4>

				{#if loading}
					<div class="py-4 text-center text-sm text-text-muted">Ładowanie...</div>
				{:else if shares.length === 0}
					<div
						class="rounded-lg border border-dashed border-border-line py-8 text-center text-sm text-text-muted italic"
					>
						Brak aktywnych linków.
					</div>
				{:else}
					<div class="space-y-2">
						{#each shares as share (share.$id)}
							{@const badge = getShareTypeBadge()}
							<div
								class="flex flex-col items-start justify-between gap-4 rounded-lg border border-border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center dark:bg-zinc-950/50"
							>
								<div class="min-w-0 space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<Globe size={16} class="shrink-0 text-primary" />
										<span class="truncate text-sm font-medium">{share.label || share.token}</span>
										<span
											class="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase {badge.class}"
											>{badge.label}</span
										>
										{#if share.passwordHash}
											<span
												class="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-600 uppercase"
												><Lock size={10} class="mr-0.5 inline" />Hasło</span
											>
										{/if}
										{#if share.maxDownloads}
											<span
												class="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 uppercase"
												>{share.downloadCount}/{share.maxDownloads}</span
											>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs text-text-muted">
										<span class="flex items-center gap-1">
											<Clock size={12} />
											{formatExpiry(share.expiresAt)}
										</span>
										<span>•</span>
										<span>{share.clicks} kliknięć</span>
									</div>
									<div class="max-w-full truncate font-mono text-xs text-text-muted/60">
										{getFullUrl(share.token)}
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-2">
									<Button
										variant="secondary"
										size="icon"
										onclick={() => handleEditStart(share)}
										title="Edytuj ustawienia linku"
									>
										<PencilSimple size={16} />
									</Button>
									<Button
										variant="secondary"
										size="icon"
										onclick={() => copyLink(share.token)}
										title="Kopiuj link"
									>
										<Copy size={16} />
									</Button>
									<Button
										variant="destructive"
										size="icon"
										onclick={() => handleDelete(share.$id)}
										title="Usuń link"
									>
										<Trash size={16} />
									</Button>
								</div>
								{#if editingShareId === share.$id}
									<form
										onsubmit={(event) => handleUpdate(event, share.$id)}
										class="w-full basis-full space-y-4 border-t border-border-line pt-4"
										autocomplete="off"
									>
										<h5 class="text-sm font-medium text-text-main">Edytuj ustawienia linku</h5>
										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<Input
												label="Etykieta"
												placeholder="np. Dla klienta X"
												bind:value={editLabel}
												autocomplete="off"
												name="edit_share_label"
											/>
											<div>
												<label
													for="editMaxDownloads-{share.$id}"
													class="mb-1.5 block text-sm font-medium text-text-main"
												>
													<Hash size={14} class="mr-1 inline" />Limit pobrań
												</label>
												<input
													type="number"
													id="editMaxDownloads-{share.$id}"
													min="1"
													placeholder="Puste = bez limitu"
													bind:value={editMaxDownloads}
													autocomplete="off"
													name="edit_share_max_downloads"
													inputmode="numeric"
													class="w-full rounded-md border border-border-line bg-white px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:bg-zinc-900"
												/>
											</div>
										</div>

										<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
											<DateTimePicker
												label="Wygasa"
												bind:value={editExpiresAt}
												onlyFutureDates={true}
											/>
											<div>
												<label
													for="editPassword-{share.$id}"
													class="mb-1.5 block text-sm font-medium text-text-main"
												>
													<Lock size={14} class="mr-1 inline" />Nowe hasło
												</label>
												<input
													type="password"
													id="editPassword-{share.$id}"
													placeholder="Puste = bez zmian"
													bind:value={editPassword}
													disabled={editRemovePassword}
													autocomplete="new-password"
													name="edit_share_password"
													class="w-full rounded-md border border-border-line bg-white px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60 dark:bg-zinc-900"
												/>
											</div>
										</div>

										{#if share.passwordHash}
											<label class="flex items-center gap-2 text-sm text-text-muted">
												<input
													type="checkbox"
													bind:checked={editRemovePassword}
													class="size-4 rounded border-border-line"
												/>
												Usuń hasło z linku
											</label>
										{/if}

										<div class="flex flex-wrap justify-end gap-2">
											<Button type="button" variant="ghost" size="sm" onclick={handleEditCancel}>
												Anuluj
											</Button>
											<Button type="submit" loading={updatingShareId === share.$id} size="sm">
												Zapisz
											</Button>
										</div>
									</form>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex w-full justify-end border-t border-border-line p-4">
			<Button variant="ghost" onclick={onClose}>Zamknij</Button>
		</div>
	</div>
</div>
