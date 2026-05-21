<script lang="ts">
	type Props = {
		class?: string;
	};

	let { class: className = '' }: Props = $props();
</script>

<div
	aria-hidden="true"
	class="animate-pulse rounded-md bg-border-line/60 dark:bg-zinc-800/80 {className}"
></div>
