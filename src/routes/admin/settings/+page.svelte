<script lang="ts">
	import { enhance } from '$app/forms';
	import { CloudArrowUp, Database, FloppyDisk, CheckCircle, Shuffle } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Destination = 'r2' | 'appwrite' | 'hybrid';

	let { data, form } = $props();

	let selected: Destination = $derived(data.service.recommended_upload_destination);

	let isSubmitting = $state(false);

	const isDirty = $derived(selected !== data.service.recommended_upload_destination);
</script>

<div class="space-y-6">
	<header class="border-b border-border-line pb-4">
		<h2 class="text-lg font-semibold text-text-main">Ustawienia przesyłania</h2>
		<p class="mt-1 text-sm text-text-muted">
			Wybierz domyślne miejsce, do którego użytkownicy będą uploadować pliki.
		</p>
	</header>

	<Card title="Rekomendowane miejsce uploadu">
		<form
			method="POST"
			action="?/updateSettings"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ result, update }) => {
					isSubmitting = false;
					if (result.type === 'success') {
						toast.success('Ustawienia zapisane');
					} else if (result.type === 'failure') {
						const msg =
							typeof result.data?.error === 'string' ? result.data.error : 'Nie udało się zapisać';
						toast.error(msg);
					}
					await update();
				};
			}}
			class="space-y-4"
		>
			<div class="grid gap-3 sm:grid-cols-3">
				<label
					class="relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all {selected ===
					'r2'
						? 'border-primary bg-primary/5'
						: 'border-border-line bg-bg-panel hover:border-gray-400 dark:hover:border-zinc-600'}"
				>
					<input
						type="radio"
						name="recommended_upload_destination"
						value="r2"
						class="sr-only"
						bind:group={selected}
					/>
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100/50 p-2 dark:bg-blue-900/20">
							<CloudArrowUp class="h-5 w-5 text-primary" />
						</div>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-text-main">Cloudflare R2</span>
								{#if selected === 'r2'}
									<CheckCircle class="h-4 w-4 text-primary" weight="fill" />
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-text-muted">
								Podpisane URL-e, multipart, maks. 5 TiB. Bez opłat za transfer wychodzący.
							</p>
						</div>
					</div>
				</label>

				<label
					class="relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all {selected ===
					'appwrite'
						? 'border-primary bg-primary/5'
						: 'border-border-line bg-bg-panel hover:border-gray-400 dark:hover:border-zinc-600'}"
				>
					<input
						type="radio"
						name="recommended_upload_destination"
						value="appwrite"
						class="sr-only"
						bind:group={selected}
					/>
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-pink-100/50 p-2 dark:bg-pink-900/20">
							<Database class="h-5 w-5 text-pink-600 dark:text-pink-400" />
						</div>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-text-main">Magazyn Appwrite</span>
								{#if selected === 'appwrite'}
									<CheckCircle class="h-4 w-4 text-primary" weight="fill" />
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-text-muted">
								Bezpośredni upload przez Appwrite SDK, max 5 GB na plik.
							</p>
						</div>
					</div>
				</label>

				<label
					class="relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all {selected ===
					'hybrid'
						? 'border-primary bg-primary/5'
						: 'border-border-line bg-bg-panel hover:border-gray-400 dark:hover:border-zinc-600'}"
				>
					<input
						type="radio"
						name="recommended_upload_destination"
						value="hybrid"
						class="sr-only"
						bind:group={selected}
					/>
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-violet-100/50 p-2 dark:bg-violet-900/20">
							<Shuffle class="h-5 w-5 text-violet-600 dark:text-violet-400" />
						</div>
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<span class="font-medium text-text-main">Hybrid</span>
								{#if selected === 'hybrid'}
									<CheckCircle class="h-4 w-4 text-primary" weight="fill" />
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-text-muted">
								Pliki ≤ 5 GiB → Appwrite, większe → R2.
							</p>
						</div>
					</div>
				</label>
			</div>

			<div class="flex items-center justify-between border-t border-border-line pt-4">
				<p class="text-xs text-text-muted">
					{#if isDirty}
						<span class="font-medium text-amber-600 dark:text-amber-400"> Niezapisane zmiany </span>
					{:else}
						Obecna wartość:
						<span class="font-mono">{data.service.recommended_upload_destination}</span>
					{/if}
				</p>

				<Button
					type="submit"
					variant="primary"
					size="default"
					disabled={isSubmitting || !isDirty}
					class="gap-2"
				>
					<FloppyDisk class="h-4 w-4" weight="bold" />
					{isSubmitting ? 'Zapisywanie…' : 'Zapisz'}
				</Button>
			</div>

			{#if form && 'error' in form}
				<p class="text-sm text-red-600 dark:text-red-400">{form.error}</p>
			{/if}
		</form>
	</Card>
</div>
