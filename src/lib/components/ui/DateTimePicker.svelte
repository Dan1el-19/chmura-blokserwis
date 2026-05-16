<script lang="ts">
	import { Calendar, Popover } from 'bits-ui';
	import { CaretLeft, CaretRight, CalendarBlank } from 'phosphor-svelte';
	import { CalendarDate, DateFormatter, today, type DateValue } from '@internationalized/date';
	import { fly } from 'svelte/transition';

	const TIMEZONE = 'Europe/Warsaw';

	type Props = {
		value: string;
		placeholder?: string;
		label?: string;
		/**
		 * @deprecated Use `onlyFutureDates` instead — the legacy name had
		 * inverted semantics (`true` actually allowed past dates).
		 */
		enableFutureDates?: boolean;
		/**
		 * When true, only today and future dates are selectable. Used by the
		 * share-link expiry picker so users cannot expire a share in the past.
		 */
		onlyFutureDates?: boolean;
	};

	let {
		value = $bindable(''),
		placeholder = 'Wybierz datę i godzinę',
		label,
		enableFutureDates,
		onlyFutureDates = false
	}: Props = $props();

	// Resolve the effective restriction. New `onlyFutureDates=true` blocks past
	// dates. The legacy `enableFutureDates` prop was misnamed: passing `true`
	// historically meant "no minValue" (past allowed). Treat any explicit value
	// as the inverse of the new prop so older call sites keep their effective
	// behaviour while we migrate.
	const restrictToFuture = $derived(onlyFutureDates || enableFutureDates === false);

	let isOpen = $state(false);
	let hour = $state('12');
	let minute = $state('00');

	const df = new DateFormatter('pl-PL', { dateStyle: 'medium', timeZone: TIMEZONE });

	let calendarValue = $state<CalendarDate | undefined>(undefined);

	$effect(() => {
		if (value && !calendarValue) {
			try {
				const date = new Date(value);
				const warsawDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
				calendarValue = new CalendarDate(
					warsawDate.getFullYear(),
					warsawDate.getMonth() + 1,
					warsawDate.getDate()
				);
				hour = warsawDate.getHours().toString().padStart(2, '0');
				minute = warsawDate.getMinutes().toString().padStart(2, '0');
			} catch {
				calendarValue = undefined;
			}
		}
	});

	function updateValue() {
		if (calendarValue) {
			const h = Math.min(23, Math.max(0, parseInt(hour) || 0));
			const m = Math.min(59, Math.max(0, parseInt(minute) || 0));
			hour = h.toString().padStart(2, '0');
			minute = m.toString().padStart(2, '0');

			value = `${calendarValue.year}-${String(calendarValue.month).padStart(2, '0')}-${String(calendarValue.day).padStart(2, '0')}T${hour}:${minute}`;
		}
	}

	function handleDateSelect(newValue: DateValue | undefined) {
		if (newValue) {
			calendarValue = new CalendarDate(newValue.year, newValue.month, newValue.day);
		} else {
			calendarValue = undefined;
		}
		updateValue();
	}

	function handleTimeChange() {
		updateValue();
	}

	function clear() {
		value = '';
		calendarValue = undefined;
		hour = '12';
		minute = '00';
	}

	let displayValue = $derived(() => {
		if (!calendarValue) return '';
		return `${df.format(calendarValue.toDate(TIMEZONE))} ${hour}:${minute}`;
	});
</script>

<div class="relative w-full">
	{#if label}
		<span class="mb-1.5 block text-xs font-medium text-text-muted">{label}</span>
	{/if}

	<Popover.Root bind:open={isOpen}>
		<Popover.Trigger
			class="flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-border-line bg-white px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 focus:ring-1 focus:ring-primary focus:outline-none dark:bg-zinc-900 dark:text-white"
		>
			<span class={calendarValue ? 'text-text-main' : 'text-text-muted/50'}>
				{displayValue() || placeholder}
			</span>
			<CalendarBlank size={16} class="text-text-muted" />
		</Popover.Trigger>

		<Popover.Content
			class="z-100 mt-2 w-auto rounded-lg border border-border-line bg-bg-panel p-0 shadow-lg"
			sideOffset={4}
			align="start"
		>
			{#snippet child({ props })}
				<div {...props} transition:fly={{ y: -10, duration: 150 }}>
					<Calendar.Root
						class="p-4"
						weekdayFormat="short"
						fixedWeeks={true}
						type="single"
						value={calendarValue}
						onValueChange={handleDateSelect}
						minValue={restrictToFuture ? today(TIMEZONE) : undefined}
					>
						{#snippet children({ months, weekdays })}
							<Calendar.Header class="mb-4 flex items-center justify-between">
								<Calendar.PrevButton
									class="inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main active:scale-95 dark:hover:bg-zinc-800"
								>
									<CaretLeft size={18} />
								</Calendar.PrevButton>
								<Calendar.Heading class="text-sm font-semibold text-text-main" />
								<Calendar.NextButton
									class="inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main active:scale-95 dark:hover:bg-zinc-800"
								>
									<CaretRight size={18} />
								</Calendar.NextButton>
							</Calendar.Header>

							<div class="flex flex-col gap-4">
								{#each months as month, i (i)}
									<Calendar.Grid class="w-full border-collapse select-none">
										<Calendar.GridHead>
											<Calendar.GridRow class="mb-1 flex w-full">
												{#each weekdays as day, j (j)}
													<Calendar.HeadCell
														class="w-9 text-center text-xs font-medium text-text-muted"
													>
														{day.slice(0, 2)}
													</Calendar.HeadCell>
												{/each}
											</Calendar.GridRow>
										</Calendar.GridHead>
										<Calendar.GridBody>
											{#each month.weeks as weekDates, k (k)}
												<Calendar.GridRow class="flex w-full">
													{#each weekDates as date, l (l)}
														<Calendar.Cell
															{date}
															month={month.value}
															class="relative size-9 p-0 text-center text-sm"
														>
															<Calendar.Day
																class="inline-flex size-9 items-center justify-center rounded-md border border-transparent text-sm font-normal text-text-main transition-colors
																	hover:border-primary/50 hover:bg-primary/10
																	data-disabled:pointer-events-none data-disabled:text-text-muted/30 data-outside-month:pointer-events-none
																	data-outside-month:text-text-muted/20
																	data-selected:bg-primary data-selected:font-medium
																	data-selected:text-white data-today:border-primary/30
																	data-unavailable:pointer-events-none data-unavailable:text-text-muted/30 data-unavailable:line-through"
															>
																{date.day}
															</Calendar.Day>
														</Calendar.Cell>
													{/each}
												</Calendar.GridRow>
											{/each}
										</Calendar.GridBody>
									</Calendar.Grid>
								{/each}
							</div>
						{/snippet}
					</Calendar.Root>

					<!-- Time Picker -->
					<div class="border-t border-border-line px-4 py-3">
						<div class="flex items-center gap-3">
							<span class="text-xs font-medium text-text-muted">Godzina:</span>
							<div class="flex items-center gap-1">
								<input
									type="text"
									inputmode="numeric"
									maxlength="2"
									bind:value={hour}
									onchange={handleTimeChange}
									class="w-12 appearance-none rounded-md border border-border-line bg-white px-2 py-1.5 text-center text-sm font-medium dark:bg-zinc-900"
								/>
								<span class="font-bold text-text-muted">:</span>
								<input
									type="text"
									inputmode="numeric"
									maxlength="2"
									bind:value={minute}
									onchange={handleTimeChange}
									class="w-12 appearance-none rounded-md border border-border-line bg-white px-2 py-1.5 text-center text-sm font-medium dark:bg-zinc-900"
								/>
							</div>
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center justify-between border-t border-border-line px-4 py-3">
						<button
							type="button"
							onclick={clear}
							class="text-xs text-text-muted transition-colors hover:text-red-500"
						>
							Clear
						</button>
						<button
							type="button"
							onclick={() => (isOpen = false)}
							class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
						>
							Done
						</button>
					</div>
				</div>
			{/snippet}
		</Popover.Content>
	</Popover.Root>
</div>
