<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import Card from '$lib/components/ui/Card.svelte';
	import Icon from '$lib/assets/favicon.svg';
	import { File, DownloadSimple, ClockCountdown, Lock, Warning } from 'phosphor-svelte';
	import { enhance } from '$app/forms';
	import { formatFileSize } from '$lib/utils/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let loading = $state(false);

	const downloadUrl = $derived(form?.downloadUrl || data.downloadUrl);
	const remainingDownloads = $derived(form?.remainingDownloads ?? data.remainingDownloads);
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-zinc-950">
	<div class="mb-8 flex flex-col items-center">
		<div class="flex items-center gap-2 text-2xl font-bold tracking-tight text-text-main">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<img src={Icon} alt="Chmura Blokserwis Logo" class="h-6 w-6" />
			</div>
			Chmura Blokserwis
		</div>
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
		{:else if data.limitReached}
			<!-- Limit Reached View -->
			<div class="flex flex-col items-center gap-6 py-8 text-center">
				<div class="rounded-full bg-red-500/10 p-6 ring-1 ring-red-500/20">
					<Warning size={48} weight="duotone" class="text-red-500" />
				</div>

				<div class="space-y-2">
					<h1 class="text-xl font-semibold text-text-main">Limit pobrań wyczerpany</h1>
					<p class="px-6 text-sm text-text-muted">
						Ten plik osiągnął maksymalną liczbę pobrań. Poproś właściciela o nowy link.
					</p>
				</div>

				<a href="/" class="mt-2 text-sm font-medium text-primary hover:underline">
					Przejdź do strony głównej
				</a>
			</div>
		{:else if data.requiresPassword && !downloadUrl}
			<!-- Password Required View -->
			<div class="flex flex-col items-center gap-6 py-6 text-center">
				<div class="rounded-full bg-amber-500/10 p-6 ring-1 ring-amber-500/20">
					<Lock size={48} weight="duotone" class="text-amber-500" />
				</div>

				<div class="space-y-1">
					<h1 class="px-4 text-xl font-semibold break-all text-text-main">{data.fileName}</h1>
					<p class="text-sm text-text-muted">{formatFileSize(data.fileSize ?? 0)}</p>
					<p class="mt-2 text-sm text-amber-600 dark:text-amber-400">
						Ten plik jest chroniony hasłem
					</p>
				</div>

				<form
					method="POST"
					action="?/unlock"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							loading = false;
							await update();
						};
					}}
					class="w-full space-y-4 px-8"
				>
					<div>
						<input
							type="password"
							name="password"
							placeholder="Wprowadź hasło"
							required
							class="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-center text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
						/>
						{#if form?.error}
							<p class="mt-2 text-sm text-red-500">{form.error}</p>
						{/if}
					</div>

					<button
						type="submit"
						disabled={loading}
						class="group inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:opacity-50"
					>
						{#if loading}
							<span
								class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
							></span>
						{:else}
							<Lock size={20} class="mr-2" />
						{/if}
						Odblokuj plik
					</button>
				</form>

				<p class="mx-auto max-w-[80%] text-xs text-text-muted/60">
					Ten plik został udostępniony publicznie z ochroną hasłem.
				</p>
			</div>
		{:else}
			<!-- Active Link View (with download URL) -->
			<div class="flex flex-col items-center gap-6 py-6 text-center">
				<div class="rounded-full bg-primary/5 p-6 ring-1 ring-primary/10">
					<File size={48} weight="duotone" class="text-primary" />
				</div>

				<div class="space-y-1">
					<h1 class="px-4 text-xl font-semibold break-all text-text-main">{data.fileName}</h1>
					<p class="text-sm text-text-muted">{formatFileSize(data.fileSize ?? 0)}</p>
					{#if data.expiresAt}
						<p class="mt-2 text-xs text-orange-500">
							Wygasa: {new Date(data.expiresAt).toLocaleString('pl-PL')}
						</p>
					{/if}
					{#if remainingDownloads !== null}
						<p class="text-xs text-text-muted">
							Pozostało pobrań: {remainingDownloads}
						</p>
					{/if}
				</div>

				<div class="w-full px-8">
					<a
						href={`/api/proxy-download?url=${encodeURIComponent(downloadUrl ?? '')}&name=${encodeURIComponent(data.fileName ?? '')}`}
						download={data.fileName}
						class="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98]"
					>
						<DownloadSimple size={22} weight="bold" />
						Pobierz plik
					</a>
				</div>
			</div>
		{/if}
	</Card>
</div>
