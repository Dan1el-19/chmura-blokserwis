<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import TagsInput from './TagsInput.svelte';
	import { Warning, Check } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import type { ParsedRelease } from '$lib/types/releases';
	import { untrack } from 'svelte';

	type Props = {
		file: File;
		existingRelease?: ParsedRelease | null;
		onConfirm: (data: {
			name: string;
			tags: string[];
			notes: string;
			overwrite: boolean;
			forceUpdate: boolean;
			channel: 'stable' | 'beta';
		}) => void;
		onCancel: () => void;
	};

	let { file, existingRelease = null, onConfirm, onCancel }: Props = $props();

	let name = $state(untrack(() => file.name));
	let extractedVersion = $derived.by(() => {
		const match = name.match(/[\w\-]+-(\d+\.\d+\.\d+(?:[.-][\w.]+)?)[\w\-]*\.apk$/i);
		const fallbackMatch = name.match(/(\d+\.\d+\.\d+)/);

		if (match) return match[1];
		return fallbackMatch ? fallbackMatch[1] : null;
	});

	// Beta detected when filename contains pre-release suffix (e.g. -dev, -alpha, -beta, -rc)
	let isBetaFilename = $derived(/[.-](dev|alpha|beta|rc)[.\d]*/i.test(name));
	let isValidFormat = $derived(/^blokse?rwis-\d+\.\d+\.\d+(?:[.-][\w.]+)?\.apk$/i.test(name));

	let tags = $state<string[]>([]);
	let notes = $state('');
	let overwrite = $state(false);
	let forceUpdate = $state(false);
	let channel = $state<'stable' | 'beta'>('stable');

	$effect(() => {
		channel = isBetaFilename ? 'beta' : 'stable';
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onConfirm({ name, tags, notes, overwrite, forceUpdate, channel });
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="release-upload-title"
>
	<Card class="w-full max-w-md border-border-line bg-bg-panel shadow-lg" title="Prześlij wydanie">
		<h2 id="release-upload-title" class="sr-only">Prześlij wydanie</h2>
		<form onsubmit={handleSubmit} class="space-y-4">
			<div
				class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/50"
			>
				<p class="text-sm text-text-muted">
					Wybrany plik: <span class="font-medium text-text-main">{name}</span>
				</p>
				<p class="mt-1 text-xs text-text-muted">
					<span title={file.name}
						>Oryginalny plik: {file.name.length > 25
							? file.name.substring(0, 25) + '...'
							: file.name}</span
					>
					<span class="mx-1">•</span>
					Rozmiar: {formatFileSize(file.size)}
				</p>
			</div>

			{#if existingRelease}
				<div
					class="flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3"
				>
					<Warning class="h-5 w-5 shrink-0 text-yellow-500" weight="fill" />
					<div class="space-y-2 text-sm">
						<p class="font-medium text-yellow-600 dark:text-yellow-400">
							Wydanie o tej nazwie już istnieje
						</p>
						<p class="text-text-muted">
							Istniejąca wersja przesłana: {new Date(
								existingRelease.$createdAt
							).toLocaleDateString()}
							({formatFileSize(existingRelease.size)})
						</p>
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={overwrite}
								class="h-4 w-4 rounded border-border-line text-primary focus:ring-primary"
							/>
							<span class="text-text-main">Nadpisz istniejące wydanie</span>
						</label>
					</div>
				</div>
			{/if}

			<div class="space-y-1">
				<Input bind:value={name} label="Nazwa pliku" placeholder="blokserwis-1.4.0.apk" required />
				<div class="flex flex-wrap items-center gap-2 pt-1 pb-2">
					{#if extractedVersion}
						<span
							class="inline-flex items-center rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-green-600 dark:text-green-400"
						>
							Wersja: v{extractedVersion}
						</span>
					{:else}
						<span
							class="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-600 dark:text-rose-400"
						>
							Brak wykrytej wersji
						</span>
					{/if}

					{#if isValidFormat}
						<span
							class="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-600 dark:text-emerald-400"
						>
							<Check class="mr-1 h-3 w-3" /> Szablon poprawny
						</span>
					{:else}
						<span
							class="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-rose-600 dark:text-rose-400"
						>
							<Warning class="mr-1 h-3 w-3" /> Wymagane: blokserwis-x.x.x.apk
						</span>
					{/if}
				</div>
			</div>

			<div class="space-y-2">
				<p class="block text-sm font-medium text-text-muted">Kanał dystrybucji</p>
				<div class="flex gap-4">
					<label class="flex cursor-pointer items-center gap-2 select-none">
						<input
							type="radio"
							name="upload-channel"
							value="stable"
							bind:group={channel}
							class="h-4 w-4 border-border-line text-primary focus:ring-primary"
						/>
						<span class="text-sm font-medium text-text-main">stable</span>
					</label>
					<label class="flex cursor-pointer items-center gap-2 select-none">
						<input
							type="radio"
							name="upload-channel"
							value="beta"
							bind:group={channel}
							class="h-4 w-4 border-border-line text-primary focus:ring-primary"
						/>
						<span class="text-sm font-medium text-text-main">beta</span>
					</label>
				</div>
				{#if isBetaFilename}
					<p class="text-xs text-amber-500">
						Wykryto sufiks beta – kanał ustawiony automatycznie na <strong>beta</strong>.
					</p>
				{/if}
			</div>

			<TagsInput bind:value={tags} label="Tagi" placeholder="Dodaj tagi wersji..." />

			<div class="space-y-1.5">
				<label for="notes" class="block text-sm font-medium text-text-muted">Notatki</label>
				<textarea
					id="notes"
					bind:value={notes}
					placeholder="Notatki wydania, lista zmian..."
					rows="3"
					class="w-full rounded-md border border-border-line bg-transparent px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
				></textarea>
			</div>

			<!-- Force Update toggle -->
			<label
				class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors {forceUpdate
					? 'border-rose-500/40 bg-rose-500/10'
					: 'border-border-line hover:border-border-line/80'}"
			>
				<input
					type="checkbox"
					bind:checked={forceUpdate}
					class="mt-0.5 h-4 w-4 shrink-0 rounded border-border-line text-rose-500 focus:ring-rose-500"
				/>
				<div>
					<p class="text-sm font-medium {forceUpdate ? 'text-rose-500' : 'text-text-main'}">
						Wymuszona aktualizacja
					</p>
					<p class="mt-0.5 text-xs text-text-muted">
						Aplikacja mobilna wymusi aktualizację — użytkownicy nie będą mogli pominąć.
					</p>
				</div>
			</label>

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Anuluj</Button>
				<Button type="submit" disabled={(!!existingRelease && !overwrite) || !isValidFormat}
					>Prześlij</Button
				>
			</div>
		</form>
	</Card>
</div>
