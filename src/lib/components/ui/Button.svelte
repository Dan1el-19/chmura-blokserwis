<script lang="ts">
	import { type Snippet } from 'svelte';

	type Props = {
		variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
		size?: 'default' | 'sm' | 'icon';
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		loading?: boolean;
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
		[key: string]: any;
	};

	let {
		variant = 'primary',
		size = 'default',
		type = 'button',
		class: className = '',
		loading = false,
		disabled = false,
		onclick,
		children,
		...rest
	}: Props = $props();

	const baseStyles =
		'inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50';

	const variants = {
		primary: 'bg-primary text-white hover:bg-primary/90 shadow-sm border border-transparent',
		secondary:
			'bg-bg-panel border border-border-line text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800',
		ghost: 'hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800 text-text-muted',
		destructive: 'bg-red-600 text-white hover:bg-red-700'
	};

	const sizes = {
		default: 'h-11 px-4 py-2 sm:h-10',
		sm: 'h-9 px-3 text-xs sm:h-8',
		icon: 'h-11 w-11 sm:h-9 sm:w-9'
	};
</script>

<button
	{type}
	class="{baseStyles} {variants[variant]} {sizes[size]} {className}"
	{disabled}
	{onclick}
	{...rest}
>
	{#if loading}
		<svg
			class="mr-2 h-4 w-4 animate-spin"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{@render children?.()}
</button>
