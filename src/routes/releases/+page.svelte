<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ReleaseDropZone from '$lib/components/releases/ReleaseDropZone.svelte';
	import ReleaseUploadModal from '$lib/components/releases/ReleaseUploadModal.svelte';
	import ReleasesList from '$lib/components/releases/ReleasesList.svelte';
	import EditReleaseDialog from '$lib/components/releases/EditReleaseDialog.svelte';
	import ForceSyncModal from '$lib/components/releases/ForceSyncModal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ReleaseUploader } from '$lib/modules/release-upload.svelte';
	import type { ParsedRelease } from '$lib/types/releases';
	import { Trash, Warning, ArrowsClockwise, CloudCheck, AndroidLogo } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	let { data } = $props();

	// Upload state
	let pendingFile = $state<File | null>(null);
	let existingRelease = $state<ParsedRelease | null>(null);
	let uploader = $state<ReleaseUploader | null>(null);
	let uploadProgress = $state(0);
	let isUploading = $state(false);
	let dropZone = $state<ReleaseDropZone | null>(null);

	// Edit state
	let editingRelease = $state<ParsedRelease | null>(null);
	let editLoading = $state(false);

	// Delete state
	let deletingRelease = $state<ParsedRelease | null>(null);
	let deleteLoading = $state(false);

	// Sync state
	let externalConfigStable = $state<any>(null);
	let externalConfigBeta = $state<any>(null);
	let configLoading = $state(true);
	let syncReleaseInfo = $state<ParsedRelease | null>(null);
	let syncLoading = $state(false);

	async function fetchExternalConfig() {
		configLoading = true;
		try {
			const [resStable, resBeta] = await Promise.all([
				fetch('/api/releases/sync?channel=stable'),
				fetch('/api/releases/sync?channel=beta')
			]);
			if (resStable.ok) externalConfigStable = (await resStable.json()).config;
			if (resBeta.ok) externalConfigBeta = (await resBeta.json()).config;
		} catch (error) {
			console.error('Fetch external config failed:', error);
		} finally {
			configLoading = false;
		}
	}

	onMount(() => {
		fetchExternalConfig();
	});

	function handleForceSyncInit(release: ParsedRelease) {
		syncReleaseInfo = release;
	}

	async function confirmForceSync(data: { forceUpdate: boolean; channel: 'stable' | 'beta' }) {
		if (!syncReleaseInfo) return;

		syncLoading = true;
		const res = await fetch('/api/releases/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				releaseId: syncReleaseInfo.$id,
				forceUpdate: data.forceUpdate,
				channel: data.channel
			})
		});

		syncLoading = false;
		syncReleaseInfo = null;

		if (res.ok) {
			await fetchExternalConfig();
		}
	}

	async function handleFileSelect(file: File) {
		// Check if release with same name exists
		const res = await fetch('/api/releases/sign', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ filename: file.name, type: file.type })
		});

		const json = await res.json();

		if (json.error === 'conflict') {
			existingRelease = json.existing;
		} else {
			existingRelease = null;
		}

		pendingFile = file;
	}

	async function handleUploadConfirm(uploadData: {
		name: string;
		tags: string[];
		notes: string;
		overwrite: boolean;
		forceUpdate: boolean;
		channel: 'stable' | 'beta';
	}) {
		if (!pendingFile) return;

		isUploading = true;

		uploader = new ReleaseUploader({
			filename: uploadData.name,
			overwrite: uploadData.overwrite,
			onProgress: (p) => {
				uploadProgress = p;
			},
			onComplete: async (result) => {
				const response = await fetch('/api/releases', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: uploadData.name,
						size: result.size,
						r2Key: result.key,
						tags: uploadData.tags,
						notes: uploadData.notes,
						overwrite: uploadData.overwrite,
						forceUpdate: uploadData.forceUpdate,
						channel: uploadData.channel
					})
				});

				if (!response.ok) {
					const payload = await response.json().catch(() => ({}));
					const errorMessage =
						payload?.error || payload?.message || 'Failed to register release in DB';
					throw new Error(errorMessage);
				}

				const payload = await response.json().catch(() => ({}));
				if (payload?.warning) {
					console.warn('Release created with warning:', payload.warning);
				}

				// Reset state and refresh
				pendingFile = null;
				existingRelease = null;
				isUploading = false;
				uploadProgress = 0;
				uploader?.destroy();
				uploader = null;

				await invalidateAll();
				await fetchExternalConfig();
			},
			onError: (err) => {
				console.error('Upload error:', err);
				isUploading = false;
				uploader?.destroy();
				uploader = null;
			}
		});

		uploader.upload(pendingFile);
	}

	function handleUploadCancel() {
		pendingFile = null;
		existingRelease = null;
		uploader?.cancel();
		uploader?.destroy();
		uploader = null;
		isUploading = false;
	}

	async function handleDownload(release: ParsedRelease) {
		const res = await fetch(`/api/releases/${release.$id}`);
		const json = await res.json();
		if (json.downloadUrl) {
			window.open(json.downloadUrl, '_blank');
		}
	}

	function handleEdit(release: ParsedRelease) {
		editingRelease = release;
	}

	async function handleEditSave(editData: { tags: string[]; notes: string }) {
		if (!editingRelease) return;

		editLoading = true;
		await fetch(`/api/releases/${editingRelease.$id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editData)
		});

		editLoading = false;
		editingRelease = null;
		await invalidateAll();
	}

	function handleDelete(release: ParsedRelease) {
		deletingRelease = release;
	}

	async function confirmDelete() {
		if (!deletingRelease) return;

		deleteLoading = true;
		await fetch(`/api/releases/${deletingRelease.$id}`, {
			method: 'DELETE'
		});

		deleteLoading = false;
		deletingRelease = null;
		await invalidateAll();
		await fetchExternalConfig();
	}
</script>

<svelte:head>
	<title>Releases | Effinity Cloud</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
	<header>
		<h1 class="text-2xl font-bold tracking-tight text-text-main">Releases</h1>
		<p class="mt-1 text-sm text-text-muted">Manage APK releases for the mobile application</p>
	</header>

	<!-- External config box -->
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="flex items-center gap-2 font-medium text-text-main">
				<CloudCheck class="h-4 w-4 text-primary" weight="bold" />
				Konfiguracja zdalna
				{#if configLoading}
					<span class="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-primary/50"></span>
				{/if}
			</h3>
			<Button variant="secondary" size="sm" onclick={fetchExternalConfig} title="Odśwież">
				<ArrowsClockwise class="h-4 w-4" />
			</Button>
		</div>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#snippet configCard(label: string, cfg: any, accent: string)}
				<div class="rounded-lg border border-border-line bg-bg-panel px-4 py-3">
					<p class="mb-1.5 text-xs font-semibold uppercase tracking-wide {accent}">{label}</p>
					{#if !configLoading && cfg}
						<p class="text-sm text-text-muted">
							Wersja: <strong class="text-text-main">{cfg.latestVersion}</strong>
							<span class="mx-1.5">•</span>
							{(cfg.apkSizeBytes / (1024 * 1024)).toFixed(2)} MB
						</p>
						{#if cfg.apkStoragePath}
							<p class="mt-0.5 truncate text-xs text-text-muted" title={cfg.apkStoragePath}>
								{cfg.apkStoragePath}
							</p>
						{/if}
						{#if cfg.forceUpdate}
							<span class="mt-1.5 inline-flex rounded-sm bg-rose-500/10 px-1.5 py-0.5 text-xs font-semibold text-rose-500">Force Update ON</span>
						{/if}
					{:else if !configLoading}
						<p class="text-sm text-text-muted">Brak danych</p>
					{/if}
				</div>
			{/snippet}
			{@render configCard('stable', externalConfigStable, 'text-emerald-500')}
			{@render configCard('beta', externalConfigBeta, 'text-amber-500')}
		</div>
	</div>


	{#if isUploading}
		<div class="rounded-lg border border-border-line bg-bg-panel p-6">
			<div class="space-y-3">
				<p class="text-sm font-medium text-text-main">Uploading...</p>
				<div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
					<div
						class="h-full bg-primary transition-all duration-300"
						style="width: {uploadProgress}%"
					></div>
				</div>
				<div class="flex items-center justify-between text-xs text-text-muted">
					<span>{uploadProgress.toFixed(0)}%</span>
					<Button variant="ghost" size="sm" onclick={handleUploadCancel}>Cancel</Button>
				</div>
			</div>
		</div>
	{:else}
		<ReleaseDropZone bind:this={dropZone} onFileSelect={handleFileSelect} />
	{/if}

	<ReleasesList
		releases={data.releases}
		onDownload={handleDownload}
		onEdit={handleEdit}
		onDelete={handleDelete}
		onForceSync={handleForceSyncInit}
	/>
</div>

<!-- Upload Modal -->
{#if pendingFile && !isUploading}
	<ReleaseUploadModal
		file={pendingFile}
		{existingRelease}
		onConfirm={handleUploadConfirm}
		onCancel={handleUploadCancel}
	/>
{/if}

<!-- Edit Dialog -->
{#if editingRelease}
	<EditReleaseDialog
		release={editingRelease}
		loading={editLoading}
		onSave={handleEditSave}
		onCancel={() => (editingRelease = null)}
	/>
{/if}

<!-- Delete Confirmation -->
{#if deletingRelease}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	>
		<div class="w-full max-w-sm rounded-lg border border-border-line bg-bg-panel p-6 shadow-lg">
			<div class="flex items-start gap-4">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
				>
					<Warning class="h-5 w-5 text-red-600" weight="fill" />
				</div>
				<div class="flex-1">
					<h3 class="font-semibold text-text-main">Delete Release</h3>
					<p class="mt-1 text-sm text-text-muted">
						Are you sure you want to delete <strong>{deletingRelease.name}</strong>? This action
						cannot be undone.
					</p>
				</div>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<Button variant="ghost" onclick={() => (deletingRelease = null)}>Cancel</Button>
				<Button variant="destructive" loading={deleteLoading} onclick={confirmDelete}>
					<Trash class="mr-2 h-4 w-4" />
					Delete
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Force Sync Dialog -->
{#if syncReleaseInfo}
	<ForceSyncModal
		release={syncReleaseInfo}
		loading={syncLoading}
		onConfirm={confirmForceSync}
		onCancel={() => (syncReleaseInfo = null)}
	/>
{/if}

<!-- Mobile FAB -->
{#if !isUploading && !pendingFile}
	<button
		onclick={() => dropZone?.openPicker()}
		class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 text-white transition-all duration-200 hover:scale-105 active:scale-95 lg:hidden"
		title="Wgraj nową wersję APK"
	>
		<AndroidLogo class="h-6 w-6" weight="fill" />
	</button>
{/if}
