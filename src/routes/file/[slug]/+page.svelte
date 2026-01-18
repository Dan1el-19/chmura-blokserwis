<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/ui/Card.svelte';
	import { File, DownloadSimple, ClockCountdown } from 'phosphor-svelte';

	let { data }: { data: PageData } = $props();

	function formatBytes(bytes: number, decimals = 2) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-zinc-950">
	<div class="mb-8 flex flex-col items-center gap-2">
		<div class="flex items-center gap-2 text-2xl font-bold tracking-tight text-text-main">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12 2L2 7L12 12L22 7L12 2Z"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M2 17L12 22L22 17"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d="M2 12L12 17L22 12"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>
			Effinity Cloud
		</div>
		<p class="text-sm text-text-muted">Bezpieczne udostępnianie plików</p>
	</div>

	<Card
		class="w-full max-w-md border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
	>
		{#if data.expired}
			<!-- Expired Link View -->
			<div class="flex flex-col items-center gap-6 py-8 text-center">
				<div class="rounded-full bg-orange-500/10 p-6 ring-1 ring-orange-500/20">
					<ClockCountdown size={48} weight="duotone" class="text-orange-500" />
				</div>

				<div class="space-y-2">
					<h1 class="text-xl font-semibold text-text-main">Link wygasł</h1>
					<p class="px-6 text-sm text-text-muted">
						Ten link do pobrania pliku już nie jest aktywny. Poproś właściciela o nowy link.
					</p>
				</div>

				<a href="/" class="mt-2 text-sm font-medium text-primary hover:underline">
					Przejdź do strony głównej
				</a>
			</div>
		{:else}
			<!-- Active Link View -->
			<div class="flex flex-col items-center gap-6 py-6 text-center">
				<div class="rounded-full bg-primary/5 p-6 ring-1 ring-primary/10">
					<File size={48} weight="duotone" class="text-primary" />
				</div>

				<div class="space-y-1">
					<h1 class="px-4 text-xl font-semibold break-all text-text-main">{data.fileName}</h1>
					<p class="text-sm text-text-muted">{formatBytes(data.fileSize ?? 0)}</p>
					{#if data.expiresAt}
						<p class="mt-2 text-xs text-orange-500">
							Wygasa: {new Date(data.expiresAt).toLocaleString('pl-PL')}
						</p>
					{/if}
				</div>

				<div class="w-full px-8">
					<a
						href={data.downloadUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
					>
						<DownloadSimple size={20} class="mr-2" />
						Pobierz plik
					</a>
				</div>

				<p class="mx-auto max-w-[80%] text-xs text-text-muted/60">
					Ten plik został udostępniony publicznie. Effinity Cloud nie ponosi odpowiedzialności za
					jego zawartość.
				</p>
			</div>
		{/if}
	</Card>

	<div class="mt-8 text-xs text-text-muted/40">
		&copy; {new Date().getFullYear()} Effinity Cloud
	</div>
</div>
