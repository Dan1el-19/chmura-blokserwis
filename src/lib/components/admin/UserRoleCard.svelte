<script lang="ts">
	import { User as UserIcon, Sparkle, Crown, FloppyDisk } from 'phosphor-svelte';
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
</script>

<Card title="User Role" description="Manage user permissions and access levels.">
	<div class="space-y-3">
		{#each ['basic', 'plus', 'admin'] as role (role)}
			{@const icons: Record<string, typeof UserIcon> = {
				basic: UserIcon,
				plus: Sparkle,
				admin: Crown
			}}
			{@const Icon = icons[role]}
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors
						{selectedRole === role
					? 'border-primary/50 bg-primary/5'
					: 'hover:bg-bg-msg-hover border-border-line'}"
			>
				<input type="radio" name="role" value={role} bind:group={selectedRole} class="sr-only" />
				<Icon
					class="h-5 w-5 {role === 'admin'
						? 'text-amber-500'
						: role === 'plus'
							? 'text-purple-500'
							: 'text-text-muted'}"
				/>
				<span class="font-medium text-text-main capitalize">{role}</span>
			</label>
		{/each}
	</div>

	{#snippet footer()}
		<Button onclick={onSave} disabled={saving || selectedRole === initialRole} class="w-full">
			<FloppyDisk class="mr-2 h-4 w-4" />
			Save Role
		</Button>
	{/snippet}
</Card>
