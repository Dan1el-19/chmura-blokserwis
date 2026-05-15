<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { toast } from 'svelte-sonner';

	let { fileId, currentName, isFolder, onCancel, onSuccess } = $props();

	let draftName = $state('');
	const displayName = $derived.by(() => (draftName.length ? draftName : currentName));
	let loading = $state(false);
	let conflictError = $state<string | null>(null);
	let suggestion = $state<string | null>(null);

	async function handleSubmit(e?: Event) {
		e?.preventDefault();
		const nameToSubmit = draftName.length ? draftName : currentName;
		if (!nameToSubmit || nameToSubmit === currentName) {
			onCancel();
			return;
		}

		loading = true;
		conflictError = null;
		suggestion = null;

		try {
			const endpoint = isFolder ? `/api/folders/${fileId}` : `/api/files/${fileId}`;
			const res = await fetch(endpoint, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: nameToSubmit })
			});

			if (res.ok) {
				toast.success(`Zmieniono nazwę na "${nameToSubmit}"`);
				onSuccess();
			} else {
				const data = await res.json();
				if (res.status === 409 && data.suggestion) {
					conflictError = 'Plik już istnieje.';
					suggestion = data.suggestion;
				} else {
					toast.error(data.error || 'Nie udało się zmienić nazwy');
				}
			}
		} catch (e: any) {
			toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	function useSuggestion() {
		if (suggestion) {
			draftName = suggestion;
			handleSubmit();
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="rename-dialog-title"
>
	<Card class="w-full max-w-sm border-border-line bg-bg-panel shadow-lg" title="Zmień nazwę">
		<h2 id="rename-dialog-title" class="sr-only">Zmień nazwę</h2>
		<form onsubmit={handleSubmit} class="space-y-4">
			<Input
				name="name"
				label="Nazwa"
				value={displayName}
				oninput={(e: Event) => {
					draftName = (e.currentTarget as HTMLInputElement).value;
				}}
				placeholder="Nowa nazwa"
				required
				autofocus
			/>

			{#if conflictError}
				<div class="rounded-md bg-red-500/10 p-3 text-sm text-red-500">
					<p class="font-bold">{conflictError}</p>
					{#if suggestion}
						<p class="mt-1">
							Sugestia: <span class="font-mono font-bold">{suggestion}</span>
						</p>
						<button type="button" class="mt-2 text-primary hover:underline" onclick={useSuggestion}>
							Użyj sugestii
						</button>
					{/if}
				</div>
			{/if}

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Anuluj</Button>
				<Button type="submit" {loading}>Zapisz</Button>
			</div>
		</form>
	</Card>
</div>
