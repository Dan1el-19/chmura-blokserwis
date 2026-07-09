<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		ArrowLeft,
		ArrowSquareOut,
		CalendarBlank,
		FolderOpen,
		HardDrives
	} from 'phosphor-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { toast } from 'svelte-sonner';
	import { formatFileSize } from '$lib/utils/format';
	import UserRoleCard from '$lib/components/admin/UserRoleCard.svelte';
	import UserStorageLimitCard from '$lib/components/admin/UserStorageLimitCard.svelte';
	import UserPasswordCard from '$lib/components/admin/UserPasswordCard.svelte';

	let { data } = $props();

	const initialRole = $derived(data.targetUser.role as 'basic' | 'plus' | 'admin');
	const initialLimit = $derived(
		data.targetUser.customLimit ? (data.targetUser.customLimit / 1024 / 1024 / 1024).toString() : ''
	);

	let selectedRole = $derived(initialRole);
	let customLimit = $derived(initialLimit);
	let saving = $state(false);

	async function saveRole() {
		saving = true;
		try {
			const res = await fetch(`/api/admin/users/${data.targetUser.$id}/role`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: selectedRole })
			});
			if (res.ok) {
				toast.success('Rola została zaktualizowana');
				invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Nie udało się zapisać roli');
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
				toast.success('Limit magazynu został zaktualizowany');
				invalidateAll();
			} else {
				const err = await res.json();
				toast.error(err.error || 'Nie udało się zapisać limitu');
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
				toast.success('Hasło zostało zaktualizowane');
			} else {
				const err = await res.json();
				toast.error(err.error || 'Nie udało się zapisać hasła');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
		saving = false;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<header class="flex flex-col gap-4 border-b border-border-line pb-5 sm:flex-row sm:items-start">
		<a href="/admin/users" class="w-fit">
			<Button variant="ghost" class="gap-2" aria-label="Wróć do listy użytkowników">
				<ArrowLeft class="h-4 w-4" />
				<span>Wszyscy użytkownicy</span>
			</Button>
		</a>
		<div class="min-w-0 sm:pt-1">
			<p class="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
				Profil użytkownika
			</p>
			<h1 class="mt-2 truncate text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
				{data.targetUser.email}
			</h1>
			<p class="mt-1 text-sm text-text-muted">
				Zarządzaj dostępem, limitem i danymi logowania w jednym miejscu.
			</p>
		</div>
	</header>

	<section
		class="overflow-hidden rounded-md border border-border-line bg-bg-panel"
		aria-label="Podsumowanie użytkownika"
	>
		<div
			class="flex flex-col gap-3 border-b border-border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
		>
			<div class="min-w-0">
				<p class="text-xs font-medium tracking-wide text-text-muted uppercase">Identyfikator</p>
				<p class="mt-1 truncate font-mono text-xs text-text-main">{data.targetUser.$id}</p>
			</div>
			<span class="w-fit rounded-full bg-bg-app px-2.5 py-1 text-xs font-medium text-text-muted">
				{data.targetUser.role === 'admin'
					? 'Administrator'
					: data.targetUser.role === 'plus'
						? 'Plus'
						: 'Podstawowy'}
			</span>
		</div>
		<dl class="grid divide-y divide-border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
			<div class="px-4 py-4 sm:px-6">
				<dt
					class="flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase"
				>
					<CalendarBlank class="h-4 w-4" /> Dołączył
				</dt>
				<dd class="mt-2 text-sm font-medium text-text-main">
					{new Date(data.targetUser.$createdAt).toLocaleDateString('pl-PL')}
				</dd>
			</div>
			<div class="px-4 py-4 sm:px-6">
				<dt
					class="flex items-center gap-2 text-xs font-medium tracking-wide text-text-muted uppercase"
				>
					<HardDrives class="h-4 w-4" /> Zajęte miejsce
				</dt>
				<dd class="mt-2 font-mono text-sm font-medium text-text-main">
					{formatFileSize(data.targetUser.storageTotalUsage)}
				</dd>
			</div>
			<div class="px-4 py-4 sm:px-6">
				<dt class="text-xs font-medium tracking-wide text-text-muted uppercase">Nazwa konta</dt>
				<dd class="mt-2 truncate text-sm font-medium text-text-main">
					{data.targetUser.name || '—'}
				</dd>
			</div>
		</dl>
	</section>

	<div class="grid gap-6 xl:grid-cols-2">
		<!-- Role Management -->
		<UserRoleCard bind:selectedRole {initialRole} {saving} onSave={saveRole} />

		<!-- Storage Limit -->
		<UserStorageLimitCard
			bind:customLimit
			usage={data.targetUser.storageUsage}
			trashUsage={data.targetUser.storageTrashUsage}
			totalUsage={data.targetUser.storageTotalUsage}
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
		<Card
			title="Pliki użytkownika"
			description="Otwórz magazyn użytkownika w trybie administracyjnym."
		>
			<div class="flex flex-col items-center justify-center py-4 text-center sm:py-6">
				<div class="mb-3 rounded-full bg-emerald-500/10 p-3 text-emerald-600">
					<FolderOpen class="h-6 w-6" />
				</div>
				<p class="mb-4 text-sm text-text-muted">
					Przejdź bezpośrednio do osobistego magazynu plików użytkownika.
				</p>
				<a href="/preview/{data.targetUser.$id}" class="w-full">
					<Button class="w-full gap-2" variant="secondary">
						<FolderOpen class="mr-2 h-4 w-4" />
						Otwórz przeglądarkę plików
						<ArrowSquareOut class="h-4 w-4" />
					</Button>
				</a>
			</div>
		</Card>
	</div>
</div>
