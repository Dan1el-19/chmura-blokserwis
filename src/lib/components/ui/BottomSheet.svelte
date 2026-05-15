<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(),
		title,
		children
	}: {
		open: boolean;
		title?: string;
		children: Snippet;
	} = $props();

	let sheetEl = $state<HTMLDivElement | null>(null);
	let dragOffset = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let pointerId: number | null = null;
	const DISMISS_THRESHOLD = 80;

	function close() {
		open = false;
		dragOffset = 0;
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
		startY = e.clientY;
		pointerId = e.pointerId;
		dragging = true;
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const dy = e.clientY - startY;
		if (dy > 0) dragOffset = dy;
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		pointerId = null;
		if (dragOffset > DISMISS_THRESHOLD) {
			close();
		} else {
			dragOffset = 0;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	$effect(() => {
		if (open && sheetEl) {
			const focusable = sheetEl.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			focusable?.focus();
		}
	});
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<button
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		onclick={close}
		aria-label="Zamknij"
		transition:fade={{ duration: 200 }}
	></button>

	<div
		bind:this={sheetEl}
		role="dialog"
		aria-modal="true"
		aria-label={title ?? 'Akcje'}
		class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-bg-panel pb-[env(safe-area-inset-bottom)] shadow-2xl"
		style:transform={dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined}
		style:transition={dragging ? 'none' : 'transform 0.25s ease'}
		in:fly={{ y: 400, duration: 280, easing: quintOut }}
		out:fly={{ y: 400, duration: 200 }}
	>
		<!-- Drag handle -->
		<div
			role="presentation"
			class="flex cursor-grab justify-center pt-3 pb-2 active:cursor-grabbing"
			style:touch-action="none"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<div class="h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-600"></div>
		</div>

		{#if title}
			<div class="px-5 pb-2">
				<p class="truncate text-sm font-medium text-text-muted">{title}</p>
			</div>
		{/if}

		<div class="flex flex-col px-2 pt-1 pb-3">
			{@render children()}
		</div>
	</div>
{/if}
