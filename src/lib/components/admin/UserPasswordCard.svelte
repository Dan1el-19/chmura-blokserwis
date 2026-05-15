<script lang="ts">
	import { Key, ArrowsClockwise } from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { toast } from 'svelte-sonner';

	let { saving, onSave } = $props<{
		saving: boolean;
		onSave: (password: string) => Promise<void> | void;
	}>();

	let newPassword = $state('');

	function generatePassword() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
		let password = '';
		for (let i = 0; i < 15; i++) {
			password += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		newPassword = password;
	}

	async function handleSave() {
		if (newPassword.length < 8) {
			toast.error('Hasło musi mieć co najmniej 8 znaków');
			return;
		}
		await onSave(newPassword);
		newPassword = '';
	}
</script>

<Card title="Reset hasła" description="Ustaw ręcznie nowe hasło dla tego użytkownika.">
	<div class="flex items-end gap-2">
		<div class="flex-1">
			<Input
				type="text"
				label="Nowe hasło"
				bind:value={newPassword}
				placeholder="Wpisz lub wygeneruj..."
				class="font-mono"
			/>
		</div>
		<Button variant="secondary" size="icon" onclick={generatePassword} title="Wygeneruj">
			<ArrowsClockwise class="h-4 w-4" />
		</Button>
	</div>

	{#snippet footer()}
		<Button
			onclick={handleSave}
			disabled={saving || !newPassword}
			class="w-full"
			variant="secondary"
		>
			<Key class="mr-2 h-4 w-4" />
			Zaktualizuj hasło
		</Button>
	{/snippet}
</Card>
