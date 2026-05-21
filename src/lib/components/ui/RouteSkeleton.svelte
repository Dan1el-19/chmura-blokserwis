<script lang="ts">
	import FileBrowserSkeleton from '$lib/components/files/FileBrowserSkeleton.svelte';
	import ReleasesListSkeleton from '$lib/components/releases/ReleasesListSkeleton.svelte';
	import AdminStatsSkeleton from '$lib/components/admin/AdminStatsSkeleton.svelte';
	import AdminUsersSkeleton from '$lib/components/admin/AdminUsersSkeleton.svelte';
	import AdminUserDetailsSkeleton from '$lib/components/admin/AdminUserDetailsSkeleton.svelte';
	import AdminSettingsSkeleton from '$lib/components/admin/AdminSettingsSkeleton.svelte';

	type Props = { routeId: string | null };
	let { routeId }: Props = $props();
</script>

{#if routeId === '/' || routeId === '/main' || routeId === '/trash' || routeId === '/preview/[userId]'}
	<FileBrowserSkeleton />
{:else if routeId === '/releases'}
	<ReleasesListSkeleton />
{:else if routeId === '/admin'}
	<AdminStatsSkeleton />
{:else if routeId === '/admin/users'}
	<AdminUsersSkeleton />
{:else if routeId === '/admin/users/[userId]'}
	<AdminUserDetailsSkeleton />
{:else if routeId === '/admin/settings'}
	<AdminSettingsSkeleton />
{/if}
