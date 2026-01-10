<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ArrowLeft, FolderOpen } from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { toast } from 'svelte-sonner';
	import UserRoleCard from '$lib/components/admin/UserRoleCard.svelte';
	import UserStorageLimitCard from '$lib/components/admin/UserStorageLimitCard.svelte';
	import UserPasswordCard from '$lib/components/admin/UserPasswordCard.svelte';

	let { data } = $props();

	const initialRole = $derived(data.targetUser.role as 'basic' | 'plus' | 'admin');
	const initialLimit = $derived(
		data.targetUser.customLimit ? (data.targetUser.customLimit / 1024 / 1024 / 1024).toString() : ''
	);

	let selectedRole = $state<'basic' | 'plus' | 'admin'>('basic');
	let customLimit = $state('');
	let saving = $state(false);

	$effect(() => {
		selectedRole = initialRole;
	});

	$effect(() => {
		customLimit = initialLimit;
	});

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

	async function savePassword(password: string) {
		saving = true;
		try {
			const res = await fetch(`/api/admin/users/${data.targetUser.$id}/password`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (res.ok) {
				toast.success('Password updated');
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
		<UserRoleCard bind:selectedRole {initialRole} {saving} onSave={saveRole} />

		<!-- Storage Limit -->
		<UserStorageLimitCard
			bind:customLimit
			usage={data.targetUser.storageUsage}
			limit={data.targetUser.storageLimit}
			roleLimitBytes={initialRole === 'admin'
				? Infinity
				: initialRole === 'plus'
					? 10 * 1024 ** 3
					: 5 * 1024 ** 3}
			{saving}
			onSave={saveStorageLimit}
		/>

		<!-- Password Reset -->
		<UserPasswordCard {saving} onSave={savePassword} />

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
