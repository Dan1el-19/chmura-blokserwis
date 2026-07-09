<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Folder,
		FileText,
		DownloadSimple,
		Trash,
		ArrowLeft,
		House,
		Cloud,
		Files,
		FolderOpen
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { triggerDownload } from '$lib/utils/download';
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	async function deleteFile(fileId: string, fileName: string) {
		if (!confirm(`Usunąć "${fileName}"?`)) return;

		try {
			const res = await fetch(`/api/files/${fileId}?targetUserId=${data.targetUser.$id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toast.success(`Usunięto: ${fileName}`);
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Nie udało się usunąć');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	async function downloadFile(fileId: string, fileName: string) {
		try {
			const res = await fetch(
				`/api/files/${fileId}?download=true&targetUserId=${data.targetUser.$id}`
			);
			const result = await res.json();
			if (result.downloadUrl) {
				toast.info(`Pobieranie: ${fileName}`);
				triggerDownload(result.downloadUrl, fileName);
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	async function deleteFolder(folderId: string, folderName: string) {
		if (!confirm(`Usunąć folder "${folderName}" wraz z całą zawartością?`)) return;

		try {
			const res = await fetch(`/api/folders/${folderId}?targetUserId=${data.targetUser.$id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toast.success(`Usunięto: ${folderName}`);
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Nie udało się usunąć');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	function downloadFolder(folderId: string, folderName: string) {
		toast.info(`Archiwizowanie: ${folderName}.zip`);
		window.location.href = `/api/folders/${folderId}/download?targetUserId=${data.targetUser.$id}`;
	}

	const currentFolderName = $derived(data.breadcrumbs.at(-1)?.name ?? 'Katalog główny');
</script>

<div class="space-y-6">
	<!-- Header -->
	<header class="flex flex-col gap-4 border-b border-border-line pb-5 sm:flex-row sm:items-start">
		<a href="/admin/users/{data.targetUser.$id}" class="w-fit">
			<Button variant="ghost" class="gap-2" aria-label="Wróć do profilu użytkownika">
				<ArrowLeft class="h-4 w-4" />
				<span>Profil użytkownika</span>
			</Button>
		</a>
		<div class="min-w-0 sm:pt-1">
			<p class="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
				Tryb administracyjny
			</p>
			<h1 class="mt-2 truncate text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
				{data.targetUser.email}
			</h1>
			<p class="mt-1 text-sm text-text-muted">
				Przeglądasz pliki użytkownika bez zmiany właściciela danych.
			</p>
		</div>
	</header>

	<!-- Breadcrumbs -->
	<nav class="overflow-x-auto pb-1" aria-label="Ścieżka folderu">
		<ol class="flex min-w-max items-center gap-1 text-sm text-text-muted">
			{#each data.breadcrumbs as crumb, i (crumb.id ?? 'root')}
				{#if i > 0}
					<li aria-hidden="true" class="px-1 text-border-line">/</li>
				{/if}
				<li>
					{#if crumb.id === null}
						<a
							href="/preview/{data.targetUser.$id}"
							class="flex items-center gap-1 rounded-sm px-1 py-1 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							<House class="h-4 w-4" />
							<span>Pliki</span>
						</a>
					{:else}
						<a
							href="/preview/{data.targetUser.$id}?folder={crumb.id}"
							class="rounded-sm px-1 py-1 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
						>
							{crumb.name}
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>

	{#if data.error}
		<p class="mt-2 text-sm text-red-500">{data.error}</p>
	{/if}

	<!-- Content -->
	<section
		class="overflow-hidden rounded-md border border-border-line bg-bg-panel"
		aria-label="Zawartość folderu"
	>
		{#if data.error}
			<div
				class="flex min-h-64 flex-col items-center justify-center px-6 text-center text-text-muted"
			>
				<div class="mb-4 rounded-full bg-bg-app p-4">
					<Cloud class="h-8 w-8 opacity-20" />
				</div>
				<p>{data.error}</p>
			</div>
		{:else if data.files.length === 0 && data.folders.length === 0}
			<div
				class="flex min-h-64 flex-col items-center justify-center px-6 text-center text-text-muted"
			>
				<div class="mb-4 rounded-full bg-bg-app p-4">
					<Cloud class="h-8 w-8 opacity-20" />
				</div>
				<p>Ten folder jest pusty</p>
			</div>
		{:else}
			<header
				class="flex flex-col gap-3 border-b border-border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
			>
				<div class="flex min-w-0 items-center gap-3">
					<div class="rounded-md bg-amber-500/10 p-2 text-amber-600">
						<FolderOpen class="h-5 w-5" />
					</div>
					<div class="min-w-0">
						<p class="text-xs font-medium tracking-wide text-text-muted uppercase">
							Bieżąca lokalizacja
						</p>
						<h2 class="mt-1 truncate text-sm font-semibold text-text-main">{currentFolderName}</h2>
					</div>
				</div>
				<div class="flex flex-wrap gap-2 text-xs font-medium text-text-muted">
					<span class="inline-flex items-center gap-1.5 rounded-full bg-bg-app px-2.5 py-1">
						<Folder class="h-3.5 w-3.5 text-amber-600" />
						{data.folders.length} folderów
					</span>
					<span class="inline-flex items-center gap-1.5 rounded-full bg-bg-app px-2.5 py-1">
						<Files class="h-3.5 w-3.5" />
						{data.files.length} plików
					</span>
				</div>
			</header>
			<!-- Table Layout -->
			<div class="w-full">
				<div
					class="hidden border-b border-border-line bg-bg-app px-6 py-3 text-xs font-medium tracking-wide text-text-muted uppercase lg:grid lg:grid-cols-[auto_minmax(0,1fr)_7rem_6rem_8.5rem] lg:items-center lg:gap-4"
				>
					<div class="w-6"></div>
					<div>Nazwa</div>
					<div class="w-32">Data</div>
					<div class="w-24">Rozmiar</div>
					<div class="w-24 text-right">Akcje</div>
				</div>

				<div class="divide-y divide-border-line">
					<!-- Folders -->
					{#each data.folders as folder (folder.$id)}
						<div
							class="group relative flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-bg-msg-hover sm:px-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_7rem_6rem_8.5rem] lg:items-center lg:gap-4 lg:py-3"
						>
							<a
								href="/preview/{data.targetUser.$id}?folder={folder.$id}"
								aria-label="Otwórz folder {folder.name}"
								class="absolute inset-0 z-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
							></a>
							<div class="pointer-events-none relative z-10 hidden text-amber-500 lg:block">
								<Folder class="h-4 w-4" />
							</div>
							<div class="pointer-events-none relative z-10 flex min-w-0 items-center gap-3 lg:gap-0">
								<Folder class="h-5 w-5 text-amber-500 lg:hidden" />
								<span class="truncate font-medium text-text-main underline-offset-4 group-hover:text-primary group-hover:underline">
									{folder.name}
								</span>
							</div>
							<div class="pointer-events-none relative z-10 grid grid-cols-2 gap-3 text-xs text-text-muted lg:contents lg:text-sm">
								<div>
									<p class="mb-1 text-[11px] font-medium tracking-wide uppercase lg:hidden">
										Utworzono
									</p>
									{new Date(folder.$createdAt).toLocaleDateString('pl-PL')}
								</div>
								<div>
									<p class="mb-1 text-[11px] font-medium tracking-wide uppercase lg:hidden">
										Rozmiar
									</p>
									{formatFileSize(folder.size ?? 0)}
								</div>
							</div>
							<div
								class="relative z-10 flex justify-end gap-1 border-t border-border-line pt-3 lg:border-0 lg:pt-0"
							>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
									onclick={() => downloadFolder(folder.$id, folder.name)}
									title="Pobierz ZIP"
									aria-label="Pobierz folder {folder.name} jako ZIP"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
									onclick={() => deleteFolder(folder.$id, folder.name)}
									title="Usuń"
									aria-label="Usuń folder {folder.name}"
								>
									<Trash class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/each}

					<!-- Files -->
					{#each data.files as file (file.$id)}
						<div
							class="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-bg-msg-hover sm:px-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_7rem_6rem_8.5rem] lg:items-center lg:gap-4 lg:py-3"
						>
							<div class="hidden text-text-muted lg:block">
								<FileText class="h-4 w-4" />
							</div>
							<div class="flex min-w-0 items-center gap-3 lg:gap-0">
								<FileText class="h-5 w-5 text-text-muted lg:hidden" />
								<span class="truncate font-medium text-text-main" title={file.name}>
									{file.name}
								</span>
							</div>
							<div class="grid grid-cols-2 gap-3 text-xs text-text-muted lg:contents lg:text-sm">
								<div>
									<p class="mb-1 text-[11px] font-medium tracking-wide uppercase lg:hidden">
										Utworzono
									</p>
									{new Date(file.$createdAt).toLocaleDateString('pl-PL')}
								</div>
								<div>
									<p class="mb-1 text-[11px] font-medium tracking-wide uppercase lg:hidden">
										Rozmiar
									</p>
									{formatFileSize(file.size)}
								</div>
							</div>
							<div
								class="flex justify-end gap-1 border-t border-border-line pt-3 lg:border-0 lg:pt-0"
							>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
									onclick={() => downloadFile(file.$id, file.name)}
									title="Pobierz"
									aria-label="Pobierz plik {file.name}"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
									onclick={() => deleteFile(file.$id, file.name)}
									title="Usuń"
									aria-label="Usuń plik {file.name}"
								>
									<Trash class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</div>
