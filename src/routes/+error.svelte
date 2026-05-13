<script lang="ts">
	import { page } from '$app/state';
	import { Warning, House, ArrowLeft } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';

	const status = $derived(page.status ?? 500);
	const message = $derived(page.error?.message ?? 'Wystąpił nieoczekiwany błąd');

	const friendly = $derived.by(() => {
		switch (status) {
			case 401:
			case 403:
				return {
					title: 'Brak dostępu',
					hint: 'Nie masz uprawnień do tego zasobu. Zaloguj się lub poproś admina o przyznanie roli.'
				};
			case 404:
				return {
					title: 'Nie znaleziono',
					hint: 'Strona, której szukasz, nie istnieje lub została usunięta.'
				};
			case 410:
				return {
					title: 'Zasób wygasł',
					hint: 'Link/zasób, do którego próbujesz dotrzeć, wygasł lub osiągnął limit pobrań.'
				};
			case 429:
				return {
					title: 'Zbyt wiele żądań',
					hint: 'Chwilowy limit zapytań — spróbuj ponownie za moment.'
				};
			default:
				return {
					title: 'Błąd serwera',
					hint: 'Coś poszło nie tak po naszej stronie. Spróbuj odświeżyć stronę lub wrócić do strony głównej.'
				};
		}
	});
</script>

<svelte:head>
	<title>{friendly.title} ({status}) | Chmura Blokserwis</title>
</svelte:head>

<div class="flex min-h-[60vh] items-center justify-center px-4">
	<div
		class="flex w-full max-w-lg flex-col items-center gap-4 rounded-lg border border-border-line bg-bg-panel p-8 text-center shadow-sm"
	>
		<div class="rounded-full bg-amber-100/50 p-3 dark:bg-amber-900/20">
			<Warning class="h-8 w-8 text-amber-500" weight="fill" />
		</div>
		<div>
			<p class="font-mono text-xs tracking-wider text-text-muted uppercase">Błąd {status}</p>
			<h1 class="mt-1 text-2xl font-bold tracking-tight text-text-main">{friendly.title}</h1>
		</div>
		<p class="text-sm text-text-muted">{friendly.hint}</p>
		{#if message && message !== friendly.title}
			<pre
				class="max-w-full overflow-x-auto rounded-md bg-gray-50 px-3 py-2 text-left font-mono text-xs text-text-muted dark:bg-zinc-900/60">{message}</pre>
		{/if}
		<div class="mt-2 flex flex-wrap justify-center gap-2">
			<Button variant="secondary" onclick={() => history.back()}>
				<ArrowLeft class="mr-2 h-4 w-4" />
				Wróć
			</Button>
			<a href="/">
				<Button variant="primary">
					<House class="mr-2 h-4 w-4" />
					Strona główna
				</Button>
			</a>
		</div>
	</div>
</div>
