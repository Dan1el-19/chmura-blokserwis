<script lang="ts">
	import { Sparkle, Crown, FloppyDisk, User as UserIcon } from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		selectedRole = $bindable(),
		initialRole,
		saving,
		onSave
	} = $props<{
		selectedRole: 'basic' | 'plus' | 'admin';
		initialRole: 'basic' | 'plus' | 'admin';
		saving: boolean;
		onSave: () => void;
	}>();

	const roles = ['basic', 'plus', 'admin'] as const;
</script>

<Card
	title="Rola użytkownika"
	description="Zarządzaj uprawnieniami i poziomem dostępu użytkownika."
>
	<div class="space-y-3">
		{#each roles as role (role)}
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors
						{selectedRole === role
					? 'border-primary/50 bg-primary/5'
					: 'hover:bg-bg-msg-hover border-border-line'}"
			>
				<input type="radio" name="role" value={role} bind:group={selectedRole} class="sr-only" />
				{#if role === 'admin'}
					<Crown class="h-5 w-5 text-amber-500" />
				{:else if role === 'plus'}
					<Sparkle class="h-5 w-5 text-purple-500" />
				{:else}
					<UserIcon class="h-5 w-5 text-text-muted" />
				{/if}
				<span class="font-medium text-text-main">
					{role === 'basic' ? 'Podstawowy' : role === 'plus' ? 'Plus' : 'Administrator'}
				</span>
			</label>
		{/each}
	</div>

	{#snippet footer()}
		<Button onclick={onSave} disabled={saving || selectedRole === initialRole} class="w-full">
			<FloppyDisk class="mr-2 h-4 w-4" />
			Zapisz rolę
		</Button>
	{/snippet}
</Card>
