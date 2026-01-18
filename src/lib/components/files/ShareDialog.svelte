<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { toast } from 'svelte-sonner';
	import { Copy, Trash, Plus, Globe, Clock, ShieldWarning, X } from 'phosphor-svelte';
	import DateTimePicker from '$lib/components/ui/DateTimePicker.svelte';
	import type { FileShare } from '$lib/types/storage';
	import { onMount } from 'svelte';

	let { fileId, onClose } = $props();

	let shares = $state<FileShare[]>([]);
	let loading = $state(false);
	let creating = $state(false);

	// Form State
	let label = $state('');
	let customSlug = $state('');
	let expiresAt = $state('');
	let autoDelete = $state(false);

	async function loadShares() {
		loading = true;
		try {
			const res = await fetch(`/api/shares?fileId=${fileId}`);
			if (res.ok) {
				shares = await res.json();
			} else {
				toast.error('Failed to load shares');
			}
		} catch (e) {
			toast.error('Network error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadShares();
	});

	async function handleCreate(e: Event) {
		e.preventDefault();
		creating = true;

		try {
			const res = await fetch('/api/shares', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileId,
					label,
					expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
					autoDelete,
					customSlug: customSlug || undefined
				})
			});

			if (res.ok) {
				toast.success('Link created');
				await loadShares();
				// Reset form
				label = '';
				customSlug = '';
				expiresAt = '';
				autoDelete = false;
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to create link');
			}
		} catch (e) {
			toast.error('Failed to create link');
		} finally {
			creating = false;
		}
	}

	async function handleDelete(shareId: string) {
		if (!confirm('Are you sure you want to delete this link?')) return;
		try {
			const res = await fetch(`/api/shares/${shareId}`, { method: 'DELETE' });
			if (res.ok) {
				toast.success('Link deleted');
				shares = shares.filter((s) => s.$id !== shareId);
			} else {
				toast.error('Failed to delete');
			}
		} catch (e) {
			toast.error('Error deleting link');
		}
	}

	function copyLink(token: string) {
		const url = `${window.location.origin}/file/${token}`;
		navigator.clipboard.writeText(url);
		toast.success('Link copied to clipboard');
	}

	function formatExpiry(dateStr: string | null) {
		if (!dateStr) return 'No expiration';
		return new Date(dateStr).toLocaleString();
	}
</script>

{#snippet footerContent()}
	<div class="flex w-full justify-end border-t border-border-line p-4">
		<Button variant="ghost" onclick={onClose}>Close</Button>
	</div>
{/snippet}

<div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm">
	<div
		class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-line bg-bg-panel shadow-lg"
	>
		<!-- Header with close button -->
		<div class="flex items-center justify-between border-b border-border-line/50 px-6 py-4">
			<h3 class="text-sm leading-none font-semibold tracking-tight text-text-main">Share File</h3>
			<button
				onclick={onClose}
				class="rounded-md p-1 text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800"
				title="Close"
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
					<Plus size={16} /> Create new link
				</h4>
				<form onsubmit={handleCreate} class="space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input label="Label (Optional)" placeholder="e.g. For Client X" bind:value={label} />
						<Input
							label="Custom URL Slug (Optional)"
							placeholder="my-custom-file-link"
							bind:value={customSlug}
						/>
					</div>

					<div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
						<DateTimePicker label="Wygasa" bind:value={expiresAt} enableFutureDates={false} />

						<div class="flex h-10 items-center gap-2">
							<input
								type="checkbox"
								id="autoDelete"
								bind:checked={autoDelete}
								class="h-4 w-4 rounded border-border-line text-primary focus:ring-primary"
							/>
							<label
								for="autoDelete"
								class="flex cursor-pointer items-center gap-1.5 text-sm text-text-main select-none"
							>
								Auto-delete file on expiry
								<ShieldWarning size={14} class="text-orange-500" />
							</label>
						</div>

						<Button type="submit" loading={creating} size="sm">Create Link</Button>
					</div>
				</form>
			</div>

			<!-- Existing Shares -->
			<div class="space-y-3">
				<h4 class="text-sm font-medium text-text-muted">Active Links ({shares.length})</h4>

				{#if loading}
					<div class="py-4 text-center text-sm text-text-muted">Loading...</div>
				{:else if shares.length === 0}
					<div
						class="rounded-lg border border-dashed border-border-line py-8 text-center text-sm text-text-muted italic"
					>
						No active shared links.
					</div>
				{:else}
					<div class="space-y-2">
						{#each shares as share (share.$id)}
							<div
								class="flex flex-col items-start justify-between gap-4 rounded-lg border border-border-line bg-white p-3 md:flex-row md:items-center dark:bg-zinc-950/50"
							>
								<div class="min-w-0 space-y-1">
									<div class="flex items-center gap-2">
										<Globe size={16} class="shrink-0 text-primary" />
										<span class="truncate text-sm font-medium">{share.label || share.token}</span>
										{#if share.autoDelete}
											<span
												class="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-500 uppercase"
												>Auto-Delete</span
											>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs text-text-muted">
										<span class="flex items-center gap-1">
											<Clock size={12} />
											{formatExpiry(share.expiresAt)}
										</span>
										<span>•</span>
										<span>{share.clicks} clicks</span>
									</div>
									<div class="max-w-[250px] truncate font-mono text-xs text-text-muted/60">
										/file/{share.token}
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-2">
									<Button
										variant="secondary"
										size="icon"
										onclick={() => copyLink(share.token)}
										title="Copy Link"
									>
										<Copy size={16} />
									</Button>
									<Button
										variant="destructive"
										size="icon"
										onclick={() => handleDelete(share.$id)}
										title="Delete Link"
									>
										<Trash size={16} />
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex w-full justify-end border-t border-border-line p-4">
			<Button variant="ghost" onclick={onClose}>Close</Button>
		</div>
	</div>
</div>
