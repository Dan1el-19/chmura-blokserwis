<script lang="ts">
	type Letterhead = {
		id: 'orange_axis' | 'technical_grid' | 'module_b';
		label: string;
		description?: string;
	};
	type Props = {
		value: Letterhead['id'];
		letterheads?: Letterhead[];
		disabled?: boolean;
		onchange: (value: Letterhead['id']) => void;
	};

	let { value, letterheads = [], disabled = false, onchange }: Props = $props();
	const defaults: Letterhead[] = [
		{
			id: 'orange_axis',
			label: 'Pomarańczowa oś',
			description: 'Dynamiczny układ z firmowym akcentem.'
		},
		{
			id: 'technical_grid',
			label: 'Siatka techniczna',
			description: 'Precyzyjny, tabelaryczny charakter.'
		},
		{ id: 'module_b', label: 'Moduł B', description: 'Spokojne, modułowe sekcje.' }
	];
	let options = $derived(letterheads.length === 3 ? letterheads : defaults);
</script>

<fieldset class="grid gap-3">
	<legend class="text-sm font-semibold text-text-main">Wariant papieru firmowego</legend>
	<div class="grid gap-2 sm:grid-cols-3">
		{#each options as option (option.id)}
			<label
				class="cursor-pointer rounded-md border p-3 transition-colors {value === option.id
					? 'border-primary bg-blue-50 dark:bg-blue-950/20'
					: 'border-border-line bg-bg-app hover:border-primary/50'}"
			>
				<input
					class="sr-only"
					type="radio"
					name="letterhead"
					value={option.id}
					{disabled}
					checked={value === option.id}
					onchange={() => onchange(option.id)}
				/>
				<span class="block text-sm font-medium text-text-main">{option.label}</span>
				{#if option.description}<span class="mt-1 block text-xs leading-5 text-text-muted"
						>{option.description}</span
					>{/if}
			</label>
		{/each}
	</div>
</fieldset>
