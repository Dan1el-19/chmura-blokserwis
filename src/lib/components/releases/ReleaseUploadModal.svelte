<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import TagsInput from './TagsInput.svelte';
	import { Warning, Check, CaretDown, CaretUp, Sparkle } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import type { ParsedRelease, ReleaseUploadDefaults } from '$lib/types/releases';
	import { inspectApk, type ApkMetadata } from '$lib/utils/apk-metadata';
	import { onMount, untrack } from 'svelte';

	const CERTIFICATE_SHA256_PATTERN = '[a-fA-F0-9]{64}';

	type Props = {
		file: File;
		existingRelease?: ParsedRelease | null;
		defaults?: ReleaseUploadDefaults | null;
		onConfirm: (data: {
			name: string;
			tags: string[];
			notes: string;
			overwrite: boolean;
			forceUpdate: boolean;
			channel: 'stable' | 'beta';
			versionCode: number;
			minSupportedVersionCode: number;
			rollout: number;
			applicationId: 'pl.blokserwis.db' | 'com.unisource.id';
			certificateSha256: string;
		}) => void;
		onCancel: () => void;
	};

	let { file, existingRelease = null, defaults = null, onConfirm, onCancel }: Props = $props();

	function extractVersion(filename: string): string | null {
		return filename.match(/(\d+\.\d+\.\d+(?:[.-][\w]+(?:[.-][\w]+)*)?)\.apk$/i)?.[1] ?? null;
	}

	function hasBetaSuffix(filename: string): boolean {
		return /[.-](dev|alpha|beta|rc)[.\d]*/i.test(filename);
	}

	const applicationDefinitions = {
		'pl.blokserwis.db': { label: 'Blokserwis', prefix: 'blokserwis' },
		'com.unisource.id': { label: 'UniSource ID', prefix: 'unisource-id' }
	} as const;
	type SupportedApplicationId = keyof typeof applicationDefinitions;

	function toSupportedApplicationId(value: string | null): SupportedApplicationId | null {
		return value === 'pl.blokserwis.db' || value === 'com.unisource.id' ? value : null;
	}

	function makeFilename(
		applicationId: keyof typeof applicationDefinitions | null,
		versionValue: string,
		channelValue: 'stable' | 'beta'
	): string {
		const normalized = versionValue.trim();
		const definition = applicationId ? applicationDefinitions[applicationId] : null;
		if (!normalized || !definition) return '';
		const betaSuffix =
			channelValue === 'beta' && !/[.-](dev|alpha|beta|rc)[.\d]*/i.test(normalized) ? '-beta' : '';
		return `${definition.prefix}-${normalized}${betaSuffix}.apk`;
	}

	function isValidReleaseFilename(filename: string): boolean {
		return /^(?:blokse?rwis|unisource-id)-\d+\.\d+\.\d+(?:[.-][\w.]+)?\.apk$/i.test(filename);
	}

	const initialChannel: 'stable' | 'beta' = untrack(() =>
		hasBetaSuffix(file.name) ? 'beta' : 'stable'
	);
	const initialVersion = untrack(
		() => extractVersion(file.name) ?? defaults?.suggestedVersion ?? ''
	);

	let version = $state(initialVersion);
	let channel = $state<'stable' | 'beta'>(initialChannel);
	let apkMetadata = $state<ApkMetadata | null>(null);
	let applicationId = $derived(toSupportedApplicationId(apkMetadata?.packageName ?? null));
	let applicationLabel = $derived(
		applicationId ? applicationDefinitions[applicationId].label : null
	);
	let name = $derived(makeFilename(applicationId, version, channel));
	let extractedVersion = $derived(extractVersion(name));
	let isBetaFilename = $derived(hasBetaSuffix(name));
	let isValidFormat = $derived(isValidReleaseFilename(name));
	let isValidVersion = $derived(/^\d+\.\d+\.\d+(?:[.-][\w.]+)?$/.test(version.trim()));
	let matchingRelease = $derived(existingRelease?.name === name ? existingRelease : null);

	let tags = $state<string[]>([]);
	let notes = $state('');
	let overwrite = $state(false);
	let forceUpdate = $state(false);
	let versionCode = $state(untrack(() => defaults?.versionCode ?? 1));
	let minSupportedVersionCode = $state(untrack(() => defaults?.minSupportedVersionCode ?? 1));
	let rollout = $state(untrack(() => defaults?.rollout ?? 100));
	let certificateSha256 = $state(untrack(() => defaults?.certificateSha256 ?? ''));
	let showAdvanced = $state(false);
	let metadataStatus = $state<'loading' | 'ready' | 'error'>('loading');
	let metadataError = $state('');
	let versionTouched = false;
	let versionCodeTouched = false;
	let certificateTouched = false;
	let manifestFieldsValid = $derived(
		applicationId !== null &&
			Number.isInteger(Number(versionCode)) &&
			Number(versionCode) > 0 &&
			Number.isInteger(Number(minSupportedVersionCode)) &&
			Number(minSupportedVersionCode) > 0 &&
			Number(minSupportedVersionCode) <= Number(versionCode) &&
			Number.isInteger(Number(rollout)) &&
			Number(rollout) >= 0 &&
			Number(rollout) <= 100 &&
			/^[a-f\d]{64}$/i.test(certificateSha256.trim())
	);

	onMount(() => {
		void inspectApk(file)
			.then((metadata) => {
				apkMetadata = metadata;
				metadataStatus = 'ready';
				if (!versionTouched && metadata.versionName) version = metadata.versionName;
				if (!versionCodeTouched && metadata.versionCode) versionCode = metadata.versionCode;
				if (!certificateTouched && metadata.certificateSha256) {
					certificateSha256 = metadata.certificateSha256;
				}
			})
			.catch((error: unknown) => {
				metadataStatus = 'error';
				metadataError = error instanceof Error ? error.message : 'Nie udało się odczytać APK';
			});
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!applicationId || !isValidVersion || !isValidFormat || !manifestFieldsValid) return;
		onConfirm({
			name,
			tags,
			notes,
			overwrite,
			forceUpdate,
			channel,
			versionCode: Number(versionCode),
			minSupportedVersionCode: Number(minSupportedVersionCode),
			rollout: Number(rollout),
			applicationId,
			certificateSha256: certificateSha256.trim().toLowerCase()
		});
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="release-upload-title"
>
	<Card class="w-full max-w-3xl border-border-line bg-bg-panel shadow-lg" title="Prześlij wydanie">
		<h2 id="release-upload-title" class="sr-only">Prześlij wydanie</h2>
		<form onsubmit={handleSubmit} class="max-h-[calc(100dvh-2rem)] space-y-5 overflow-y-auto pr-1">
			<div class="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
				<div class="space-y-4">
					<div
						class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700/50 dark:bg-zinc-800/50"
					>
						<p class="text-sm text-text-muted">
							APK: <span class="font-medium text-text-main">{file.name}</span>
						</p>
						<p class="mt-1 text-xs text-text-muted">
							Rozmiar: {formatFileSize(file.size)}
							<span class="mx-1">•</span>
							Nazwa wydania:
							<span class="font-medium text-text-main">{name || 'uzupełnij wersję'}</span>
						</p>
					</div>

					{#if matchingRelease}
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
										matchingRelease.$createdAt
									).toLocaleDateString()}
									({formatFileSize(matchingRelease.size)})
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
						<Input
							bind:value={version}
							label="Wersja aplikacji"
							placeholder="1.12.3"
							required
							oninput={() => (versionTouched = true)}
							error={version.length > 0 && !isValidVersion
								? 'Podaj wersję w formacie 1.12.3'
								: undefined}
						/>
						<div class="flex flex-wrap items-center gap-2 pt-1 pb-1">
							{#if extractedVersion}
								<span
									class="inline-flex items-center rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-green-600 dark:text-green-400"
								>
									<Check class="mr-1 h-3 w-3" /> Wersja v{extractedVersion}
								</span>
							{/if}
							{#if isValidFormat}
								<span
									class="inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-600 dark:text-emerald-400"
								>
									Nazwa pliku zostanie ustawiona automatycznie
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
								Kanał beta doda sufiks <strong>-beta</strong> do nazwy wydania.
							</p>
						{/if}
					</div>

					<section class="rounded-md border border-primary/20 bg-primary/5 p-3" aria-live="polite">
						<div class="flex items-start gap-2">
							<Sparkle class="mt-0.5 h-4 w-4 shrink-0 text-primary" weight="fill" />
							<div class="min-w-0 text-xs text-text-muted">
								{#if metadataStatus === 'loading'}
									<p class="font-medium text-text-main">Czytam manifest z APK…</p>
									<p class="mt-1">Pobieram wersję, versionCode i certyfikat podpisujący.</p>
								{:else if metadataStatus === 'ready'}
									<p
										class="font-medium {applicationId
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-rose-600 dark:text-rose-400'}"
									>
										{#if applicationLabel}{applicationLabel} wykryty{:else}Nieobsługiwana aplikacja{/if}
									</p>
									<div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
										<span class="col-span-2 truncate"
											>Package: {apkMetadata?.packageName ?? 'brak'}</span
										>
										<span>Wersja: {apkMetadata?.versionName ?? 'brak'}</span>
										<span>Numer: {apkMetadata?.versionCode ?? 'brak'}</span>
										<span class="col-span-2 truncate">
											Certyfikat: {apkMetadata?.certificateSha256 ? 'odczytany' : 'brak w APK'}
										</span>
									</div>
									{#if !applicationId}
										<p class="mt-2 text-rose-600 dark:text-rose-400">
											Dozwolone są tylko APK Blokserwis i UniSource ID.
										</p>
									{/if}
								{:else}
									<p class="font-medium text-rose-600 dark:text-rose-400">
										Nie udało się odczytać manifestu APK
									</p>
									<p class="mt-1 break-words">{metadataError}</p>
								{/if}
							</div>
						</div>
					</section>
				</div>

				<div class="space-y-4">
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

					<div class="rounded-md border border-border-line">
						<button
							type="button"
							class="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-text-main"
							onclick={() => (showAdvanced = !showAdvanced)}
							aria-expanded={showAdvanced}
						>
							<span>Ustawienia zaawansowane</span>
							{#if showAdvanced}<CaretUp class="h-4 w-4" />{:else}<CaretDown class="h-4 w-4" />{/if}
						</button>

						{#if showAdvanced}
							<div class="space-y-3 border-t border-border-line px-3 pt-3 pb-3">
								<p class="text-xs text-text-muted">
									Zwykle nie trzeba tu nic zmieniać. Wartości są wczytane z poprzedniego wydania.
								</p>
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<Input
										bind:value={versionCode}
										label="Numer wersji (versionCode)"
										type="number"
										min="1"
										oninput={() => (versionCodeTouched = true)}
										required
									/>
									<Input
										bind:value={minSupportedVersionCode}
										label="Minimalny numer wersji"
										type="number"
										min="1"
										error={Number(minSupportedVersionCode) > Number(versionCode)
											? 'Nie może być większy od numeru wersji'
											: undefined}
										required
									/>
								</div>

								<Input
									bind:value={rollout}
									label="Zakres wdrożenia (%)"
									type="number"
									min="0"
									max="100"
									required
								/>

								<Input
									bind:value={certificateSha256}
									label="Certyfikat podpisujący (SHA-256)"
									placeholder="wczytany automatycznie"
									class="font-mono"
									oninput={() => (certificateTouched = true)}
									maxlength="64"
					pattern={'[a-fA-F0-9]{64}'}
									error={certificateSha256.length > 0 &&
									!/^[a-f\d]{64}$/i.test(certificateSha256.trim())
										? 'Wymagane jest dokładnie 64 znaki hex'
										: undefined}
									required
								/>

								<TagsInput bind:value={tags} label="Tagi" placeholder="Dodaj tagi wersji..." />
							</div>
						{/if}
					</div>
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

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<Input bind:value={versionCode} label="versionCode" type="number" min="1" required />
				<Input
					bind:value={minSupportedVersionCode}
					label="Minimalny versionCode"
					type="number"
					min="1"
					error={Number(minSupportedVersionCode) > Number(versionCode)
						? 'Minimalna wersja nie może być większa od versionCode'
						: undefined}
					required
				/>
			</div>

			<Input bind:value={rollout} label="Rollout (%)" type="number" min="0" max="100" required />

			<Input
				bind:value={certificateSha256}
				label="SHA-256 certyfikatu podpisującego"
				placeholder="64 znaki hex"
				class="font-mono"
				maxlength="64"
				pattern={CERTIFICATE_SHA256_PATTERN}
				error={certificateSha256.length > 0 && !/^[a-f\d]{64}$/i.test(certificateSha256.trim())
					? 'Wymagane jest dokładnie 64 znaki hex'
					: undefined}
				required
			/>

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
				<Button
					type="submit"
					disabled={metadataStatus === 'loading' ||
						!isValidVersion ||
						!isValidFormat ||
						(!!matchingRelease && !overwrite) ||
						!manifestFieldsValid}>Prześlij wydanie</Button
				>
			</div>
		</form>
	</Card>
</div>
