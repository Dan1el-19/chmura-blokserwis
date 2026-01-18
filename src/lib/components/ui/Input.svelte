<script lang="ts">
	type Props = {
		label?: string;
		error?: string;
		class?: string;
		[key: string]: any;
	};

	let { label, value = $bindable(), error, class: className = '', ...rest }: Props = $props();
	const id = rest.id || `input-${Math.random().toString(36).substring(2, 9)}`;
</script>

<div class={className}>
	{#if label}
		<label for={id} class="mb-1.5 block text-sm font-medium text-text-muted">
			{label}
		</label>
	{/if}
	<input
		{id}
		bind:value
		class="input-ghost flex h-10 w-full rounded-md border border-border-line bg-transparent px-3 py-2 text-sm placeholder:text-text-muted focus:border-primary focus:bg-bg-panel focus:ring-1 focus:ring-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		{...rest}
	/>
	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
</div>
