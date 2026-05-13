<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let { parentFolderId, onCancel } = $props();
	let loading = $state(false);
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="create-folder-title"
>
	<Card class="w-full max-w-sm border-border-line bg-bg-panel shadow-lg" title="New Folder">
		<form
			method="POST"
			action="?/createFolder"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
					onCancel();
				};
			}}
			class="space-y-4"
		>
			<h2 id="create-folder-title" class="sr-only">Utwórz nowy folder</h2>
			<input type="hidden" name="parentFolderId" value={parentFolderId || ''} />
			<Input name="folderName" label="Name" placeholder="Folder name" required autofocus />

			<div class="flex justify-end gap-2 pt-2">
				<Button variant="ghost" onclick={onCancel} type="button">Cancel</Button>
				<Button type="submit" {loading}>Create</Button>
			</div>
		</form>
	</Card>
</div>
