<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		ArrowLeft,
		Crown,
		Sparkle,
		User as UserIcon,
		Key,
		ArrowsClockwise,
		FolderOpen,
		FloppyDisk
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	const initialRole = $derived(data.targetUser.role as 'basic' | 'plus' | 'admin');
	const initialLimit = $derived(
		data.targetUser.customLimit ? (data.targetUser.customLimit / 1024 / 1024 / 1024).toString() : ''
	);

	let selectedRole = $state<'basic' | 'plus' | 'admin'>('basic');
	let customLimit = $state('');
	let newPassword = $state('');
	let saving = $state(false);

	$effect(() => {
		selectedRole = initialRole;
	});

	$effect(() => {
		customLimit = initialLimit;
	});

	function generatePassword() {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
		let password = '';
		for (let i = 0; i < 15; i++) {
			password += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		newPassword = password;
	}

	async function saveRole() {
		saving = true;
		try {
			const res = await fetch(`/api/admin/users/${data.targetUser.$id}/role`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: selectedRole })
			});
			if (res.ok) {
				toast.success('Role updated successfully');
				invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to save role');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
		saving = false;
	}

	async function saveStorageLimit() {
		saving = true;
		try {
			const limitBytes = customLimit ? parseFloat(customLimit) * 1024 * 1024 * 1024 : null;
			const res = await fetch(`/api/admin/users/${data.targetUser.$id}/storage-limit`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ limit: limitBytes })
			});
			if (res.ok) {
				toast.success('Storage limit updated');
				invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to save limit');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
		saving = false;
	}

	async function savePassword() {
		if (newPassword.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}
		saving = true;
		try {
			const res = await fetch(`/api/admin/users/${data.targetUser.$id}/password`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password: newPassword })
			});
			if (res.ok) {
				toast.success('Password updated');
				newPassword = '';
			} else {
				const err = await res.json();
				toast.error(err.error || 'Failed to save password');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
		saving = false;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a href="/admin/users">
			<Button variant="ghost" size="icon">
				<ArrowLeft class="h-5 w-5" />
			</Button>
		</a>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-text-main lg:text-2xl">
				{data.targetUser.email}
			</h1>
			<p class="text-sm text-text-muted">
				User ID: <span class="font-mono text-xs">{data.targetUser.$id}</span> • Joined: {new Date(
					data.targetUser.$createdAt
				).toLocaleDateString('pl-PL')}
			</p>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- Role Management -->
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
						<input
							type="radio"
							name="role"
							value={role}
							bind:group={selectedRole}
							class="sr-only"
						/>
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
				<Button
					onclick={saveRole}
					disabled={saving || selectedRole === data.targetUser.role}
					class="w-full"
				>
					<FloppyDisk class="mr-2 h-4 w-4" />
					Save Role
				</Button>
			{/snippet}
		</Card>

		<!-- Storage Limit -->
		<Card title="Storage Limit" description="Set a custom storage quota for this user.">
			<div class="space-y-4">
				<div class="rounded-md bg-bg-app p-3">
					<p class="text-sm text-text-muted">Current Usage</p>
					<div class="flex items-baseline gap-2">
						<span class="text-lg font-bold text-text-main">
							{formatFileSize(data.targetUser.storageUsage)}
						</span>
						<span class="text-text-muted">/</span>
						<span class="text-sm text-text-muted">
							{data.targetUser.storageLimit === Infinity
								? 'Unlimited'
								: formatFileSize(data.targetUser.storageLimit)}
						</span>
					</div>
				</div>

				<div class="flex items-end gap-2">
					<Input
						type="number"
						label="Custom Limit (GB)"
						bind:value={customLimit}
						placeholder="Default"
						class="flex-1"
					/>
				</div>
				<p class="text-xs text-text-muted">
					Current Role Limit: {formatFileSize(
						initialRole === 'admin'
							? Infinity
							: initialRole === 'plus'
								? 10 * 1024 ** 3
								: 5 * 1024 ** 3
					)}
				</p>
			</div>

			{#snippet footer()}
				<Button onclick={saveStorageLimit} disabled={saving} class="w-full">
					<FloppyDisk class="mr-2 h-4 w-4" />
					Save Limit
				</Button>
			{/snippet}
		</Card>

		<!-- Password Reset -->
		<Card title="Reset Password" description="Manually set a new password for this user.">
			<div class="flex items-end gap-2">
				<div class="flex-1">
					<Input
						type="text"
						label="New Password"
						bind:value={newPassword}
						placeholder="Enter or generate..."
						class="font-mono"
					/>
				</div>
				<Button variant="secondary" size="icon" onclick={generatePassword} title="Generate">
					<ArrowsClockwise class="h-4 w-4" />
				</Button>
			</div>

			{#snippet footer()}
				<Button
					onclick={savePassword}
					disabled={saving || !newPassword}
					class="w-full"
					variant="secondary"
				>
					<Key class="mr-2 h-4 w-4" />
					Update Password
				</Button>
			{/snippet}
		</Card>

		<!-- User Files -->
		<Card title="User Files" description="View and manage files owned by this user.">
			<div class="flex flex-col items-center justify-center py-6 text-center">
				<div class="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600">
					<FolderOpen class="h-6 w-6" />
				</div>
				<p class="mb-4 text-sm text-text-muted">Browse user's personal file storage directly.</p>
				<a href="/preview/{data.targetUser.$id}" class="w-full">
					<Button class="w-full" variant="secondary">
						<FolderOpen class="mr-2 h-4 w-4" />
						Open File Browser
					</Button>
				</a>
			</div>
		</Card>
	</div>
</div>
