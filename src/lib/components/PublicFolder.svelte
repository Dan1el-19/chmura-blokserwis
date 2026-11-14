<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import TextPreview from './TextPreview.svelte';
	import { mediaKindForFilename } from '#lib/media-preview.js';
	let {address}:{address:string}=$props();
	type Item={id:string;name:string;kind:'FILE'|'FOLDER';sizeBytes:number|null};
	type Preview={url:string;contentId?:string;expiresAt:string};
	let entries=$state<Item[]>([]), breadcrumbs=$state<{id:string;name:string}[]>([]), next=$state(''), error=$state(''), busy=$state(false);
	let folderId=$state(''), selected=$state<Item>(), preview=$state<Preview | null>(null);
	let generation=0;
	let previewGeneration=0;
	let timer:ReturnType<typeof setTimeout> | undefined;
	async function load(id='',token='') {
		const current=++generation; busy=true;error='';
		const query=new SvelteURLSearchParams(); if(id) query.set('folder',id); if(token) query.set('pageToken',token);
		try {
			const response=await fetch(`/s/${encodeURIComponent(address)}/folder?${query}`,{cache:'no-store'});
			if (!response.ok) throw new Error('Nie można otworzyć folderu.');
			const result=await response.json() as {entries:Item[];breadcrumbs:{id:string;name:string}[];nextPageToken:string};
			if(current!==generation) return;
			folderId=id; entries=token?[...entries,...result.entries]:result.entries;breadcrumbs=result.breadcrumbs;next=result.nextPageToken;
		} catch(e) {if(current===generation) error=e instanceof Error?e.message:'Błąd połączenia.';}
		finally {if(current===generation) busy=false;}
	}
	async function openFile(item:Item) {
		const current=++previewGeneration;
		selected=item; preview=null; error=''; if(timer) clearTimeout(timer);
		try {
			const response=await fetch(`/s/${encodeURIComponent(address)}/info?file=${encodeURIComponent(item.id)}`,{cache:'no-store'});
			if (!response.ok) throw new Error('Nie można otworzyć pliku.');
			const result=await response.json() as {preview:Preview|null};
			if(current!==previewGeneration || selected?.id!==item.id) return;
			preview=result.preview;
			if(preview) {const remaining=new Date(preview.expiresAt).getTime()-Date.now(); if(remaining>10000) timer=setTimeout(()=>void openFile(item),remaining-10000);}
		} catch(e) {if(current===previewGeneration) error=e instanceof Error?e.message:'Błąd połączenia.';}
	}
	onMount(()=>{void load();});
	onDestroy(()=>{generation++;previewGeneration++;if(timer) clearTimeout(timer);});
</script>
{#if error}<p role="alert" class="rounded bg-red-500/10 p-3 text-sm text-red-600">{error}</p>{/if}
{#if selected}
	<button type="button" class="text-sm underline" onclick={() => {previewGeneration++;selected=undefined;preview=null;if(timer)clearTimeout(timer);}}>Wróć do folderu</button>
	<h2 class="break-all font-semibold">{selected.name}</h2>
	{#key `${preview?.contentId ?? ''}:${preview?.url ?? ''}`}
		{#if preview && mediaKindForFilename(selected.name)==='PDF'}<iframe title={`Podgląd PDF: ${selected.name}`} src={preview.url} sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" class="h-[65dvh] w-full rounded border border-border-line"></iframe>
		{:else if preview && mediaKindForFilename(selected.name)==='TEXT'}<TextPreview url={preview.url} sizeBytes={selected.sizeBytes ?? 0}/>
		{:else if preview && mediaKindForFilename(selected.name)==='IMAGE'}<img src={preview.url} alt={selected.name} class="max-h-[65dvh] max-w-full object-contain"/>
		{:else if preview && mediaKindForFilename(selected.name)==='AUDIO'}<audio src={preview.url} controls aria-label={`Odtwarzacz audio: ${selected.name}`}></audio>
		{:else if preview && mediaKindForFilename(selected.name)==='VIDEO'}<!-- svelte-ignore a11y_media_has_caption --><video src={preview.url} controls class="max-h-[65dvh] w-full" aria-label={`Odtwarzacz wideo: ${selected.name}`}></video>{/if}
	{/key}
	<form method="GET" action={`/s/${encodeURIComponent(address)}/download`}><input type="hidden" name="file" value={selected.id}/><button class="rounded bg-primary px-4 py-2 text-white">Pobierz</button></form>
{:else}
	<nav aria-label="Ścieżka folderu" class="flex flex-wrap gap-2 text-sm">{#each breadcrumbs as crumb (crumb.id)}<button type="button" class="underline" onclick={() => void load(crumb.id)}>{crumb.name}</button>{/each}</nav>
	{#if !busy && !entries.length}<p class="text-sm text-text-muted">Folder jest pusty.</p>{/if}
	<ul class="divide-y divide-border-line">{#each entries as item (item.id)}<li class="flex items-center justify-between gap-3 py-3"><button type="button" class="min-w-0 truncate text-left hover:underline" onclick={() => item.kind==='FOLDER' ? void load(item.id) : void openFile(item)}>{item.kind==='FOLDER' ? '📁 ' : '📄 '}{item.name}</button>{#if item.kind==='FILE'}<form method="GET" action={resolve('/s/[address]/download', {address})}><input type="hidden" name="file" value={item.id}/><button class="text-sm underline">Pobierz</button></form>{/if}</li>{/each}</ul>
	{#if next}<button type="button" disabled={busy} class="rounded border border-border-line px-4 py-2 text-sm" onclick={() => void load(folderId,next)}>Pokaż więcej</button>{/if}
{/if}
