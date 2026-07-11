<script lang="ts">
	import { CloudArrowUp } from 'phosphor-svelte';

	let { openFilePicker } = $props<{ openFilePicker: () => void }>();
</script>

<!-- Desktop-only upload hint — actual drop is handled page-level -->
<button
	type="button"
	onclick={openFilePicker}
	class="hidden w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-line px-4 py-3 text-sm text-text-muted transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none lg:flex"
>
	<CloudArrowUp class="h-4 w-4" />
	<span>Przeciągnij pliki na stronę lub <span class="font-medium text-primary">wybierz</span></span>
</button>
