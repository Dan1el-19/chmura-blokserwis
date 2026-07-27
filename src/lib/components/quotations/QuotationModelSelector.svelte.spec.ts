import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuotationModelPrice } from '$lib/quotations/types';
import QuotationModelSelector from './QuotationModelSelector.svelte';

const models: QuotationModelPrice[] = [
	['openrouter/free', 'OpenRouter Free', 'free'],
	['deepseek/deepseek-v4-flash', 'DeepSeek V4 Flash', 'fast'],
	['deepseek/deepseek-v4-pro', 'DeepSeek V4 Pro', 'standard'],
	['openai/gpt-5.6-luna', 'GPT-5.6 Luna', 'premium'],
	['anthropic/claude-haiku-4.5', 'Claude Haiku 4.5', 'premium_anthropic']
].map(([id, name, category]) => ({
	id,
	name,
	category,
	available: true,
	promptPriceUsd: category === 'free' ? '0' : '0.000001',
	completionPriceUsd: category === 'free' ? '0' : '0.000002',
	reasoningSupported: category !== 'free',
	reasoningEfforts: category === 'premium' || category === 'premium_anthropic' ? ['low'] : ['high']
}));

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('QuotationModelSelector', () => {
	it('renders five ordered radio choices and reports a manual selection', () => {
		const onchange = vi.fn();
		component = mount(QuotationModelSelector, {
			target: document.body,
			props: {
				models,
				value: 'deepseek/deepseek-v4-pro',
				onchange,
				onreasoningchange: vi.fn(),
				onresetauto: vi.fn()
			}
		});

		const radios = [...document.querySelectorAll<HTMLElement>('[role="radio"]')];
		expect(radios).toHaveLength(5);
		expect(radios.map((radio) => radio.getAttribute('data-value'))).toEqual(
			models.map((model) => model.id)
		);
		expect(radios[2].getAttribute('aria-checked')).toBe('true');
		const copy = document.body.textContent?.replace(/\s+/g, ' ');
		expect(copy).toContain('Standardowy');
		expect(copy).toContain('DeepSeek V4 Pro');
		radios[3].click();
		flushSync();
		expect(onchange).toHaveBeenCalledWith('openai/gpt-5.6-luna');
	});

	it('shows the adaptive effort and warns that reasoning costs more', () => {
		const onreasoningchange = vi.fn();
		component = mount(QuotationModelSelector, {
			target: document.body,
			props: {
				models,
				value: 'openai/gpt-5.6-luna',
				reasoningEnabled: true,
				onchange: vi.fn(),
				onreasoningchange,
				onresetauto: vi.fn()
			}
		});

		const switchButton = document.querySelector<HTMLElement>('[role="switch"]');
		expect(switchButton?.getAttribute('aria-checked')).toBe('true');
		const copy = document.body.textContent?.replace(/\s+/g, ' ');
		expect(copy).toContain('poziomem low');
		expect(copy).toContain('więcej tokenów');
		expect(copy).toContain('Szacunek generowania');
		expect(copy).toContain('wejście 1 USD');
		expect(copy).toContain('wyjście 2 USD');
		switchButton?.click();
		flushSync();
		expect(onreasoningchange).toHaveBeenCalledWith(false);
	});

	it('shows zero pricing and disables reasoning for the Free router', () => {
		component = mount(QuotationModelSelector, {
			target: document.body,
			props: {
				models,
				value: 'openrouter/free',
				onchange: vi.fn(),
				onreasoningchange: vi.fn(),
				onresetauto: vi.fn()
			}
		});

		const switchButton = document.querySelector<HTMLButtonElement>('[role="switch"]');
		const copy = document.body.textContent?.replace(/\s+/g, ' ');
		expect(switchButton?.disabled).toBe(true);
		expect(copy).toContain('wejście 0 USD');
		expect(copy).toContain('wyjście 0 USD');
	});
});
