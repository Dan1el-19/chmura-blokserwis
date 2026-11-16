<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { QuoteScopeSectionSchema, type QuoteScopeSection } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field } from './ui.js';

	let { sections = $bindable(), onchange }: { sections: QuoteScopeSection[]; onchange: () => void } = $props();
	function move(index: number, offset: number) {
		const target = index + offset;
		if (target < 0 || target >= sections.length) return;
		const next = [...sections];
		[next[index], next[target]] = [next[target], next[index]];
		sections = next;
		onchange();
	}
	function remove(index: number) { sections = sections.filter((_, i) => i !== index); onchange(); }
	function add() { sections = [...sections, create(QuoteScopeSectionSchema)]; onchange(); }
</script>

<div class="space-y-4">
	{#each sections as section, index (section)}
		<div class="space-y-3 rounded-lg border border-border-line p-4">
			<label class="block text-sm">Nagłówek
				<input class={field} aria-label={`Nagłówek podsekcji ${index + 1}`} bind:value={section.heading} oninput={onchange} />
			</label>
			<label class="block text-sm">Treść
				<textarea class={field} rows="4" aria-label={`Treść podsekcji ${index + 1}`} bind:value={section.body} oninput={onchange}></textarea>
			</label>
			<div class="flex flex-wrap gap-2">
				<button type="button" class={button} aria-label={`Przenieś podsekcję ${index + 1} w górę`} disabled={index === 0} onclick={() => move(index, -1)}>W górę</button>
				<button type="button" class={button} aria-label={`Przenieś podsekcję ${index + 1} w dół`} disabled={index === sections.length - 1} onclick={() => move(index, 1)}>W dół</button>
				<button type="button" class={button} aria-label={`Usuń podsekcję ${index + 1}`} onclick={() => remove(index)}>Usuń</button>
			</div>
		</div>
	{/each}
	<button type="button" class={button} disabled={sections.length >= 30} onclick={add}>Dodaj podsekcję</button>
</div>
