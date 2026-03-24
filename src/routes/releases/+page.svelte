<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ReleaseDropZone from '$lib/components/releases/ReleaseDropZone.svelte';
	import ReleaseUploadModal from '$lib/components/releases/ReleaseUploadModal.svelte';
	import ReleasesList from '$lib/components/releases/ReleasesList.svelte';
	import EditReleaseDialog from '$lib/components/releases/EditReleaseDialog.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ReleaseUploader } from '$lib/modules/release-upload.svelte';
	import type { ParsedRelease } from '$lib/types/releases';
	import { Trash, Warning } from 'phosphor-svelte';

	let { data } = $props();

	// Upload state
	let pendingFile = $state<File | null>(null);
	let existingRelease = $state<ParsedRelease | null>(null);
	let uploader = $state<ReleaseUploader | null>(null);
	let uploadProgress = $state(0);
	let isUploading = $state(false);

	// Edit state
	let editingRelease = $state<ParsedRelease | null>(null);
	let editLoading = $state(false);

	// Delete state
	let deletingRelease = $state<ParsedRelease | null>(null);
	let deleteLoading = $state(false);

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
				// Create release record in DB
				const res = await fetch('/api/releases', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: uploadData.name,
						size: result.size,
						r2Key: result.key,
						tags: uploadData.tags,
						notes: uploadData.notes,
						overwrite: uploadData.overwrite,
						forceUpdate: uploadData.forceUpdate
					})
				});

				if (!res.ok) {
					console.error('Failed to register release in DB:', await res.text());
					// It's a best effort to clean up, but file might be orphaned in R2.
					// At least the user should see an error, but let's reset state for now.
				}

				// Reset state and refresh
				pendingFile = null;
				existingRelease = null;
				isUploading = false;
				uploadProgress = 0;
				uploader?.destroy();
				uploader = null;

				await invalidateAll();
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
		<ReleaseDropZone onFileSelect={handleFileSelect} />
	{/if}

	<ReleasesList
		releases={data.releases}
		onDownload={handleDownload}
		onEdit={handleEdit}
		onDelete={handleDelete}
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
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm">
		<div
			class="w-full max-w-sm rounded-lg border border-border-line bg-bg-panel p-6 shadow-lg"
		>
			<div class="flex items-start gap-4">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
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
