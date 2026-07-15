import { describe, expect, it } from 'vitest';
import { modelReasoningEffort, quotationModelCategory, quotationModelForAction } from './models';
import type { QuotationModelPrice } from './types';

const models: QuotationModelPrice[] = [
	{
		id: 'deepseek/deepseek-v4-flash',
		name: 'DeepSeek V4 Flash',
		category: 'fast',
		defaultFor: ['revise_block'],
		reasoningSupported: true,
		reasoningEfforts: ['high']
	},
	{
		id: 'deepseek/deepseek-v4-pro',
		name: 'DeepSeek V4 Pro',
		category: 'standard',
		defaultFor: ['generate'],
		reasoningSupported: true,
		reasoningEfforts: ['high']
	}
];

describe('quotation model catalog', () => {
	it('uses backend defaults for complete generation and block revisions', () => {
		expect(quotationModelForAction(models, 'generate')?.id).toBe('deepseek/deepseek-v4-pro');
		expect(quotationModelForAction(models, 'revise_block')?.id).toBe('deepseek/deepseek-v4-flash');
	});

	it('falls back to stable OpenRouter IDs when category metadata is absent', () => {
		expect(quotationModelCategory({ id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna' })).toBe(
			'premium'
		);
		expect(
			quotationModelCategory({ id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' })
		).toBe('premium_anthropic');
	});

	it('uses low reasoning for premium models, high for DeepSeek and none for Free', () => {
		expect(modelReasoningEffort(models[0])).toBe('high');
		expect(
			modelReasoningEffort({
				id: 'openai/gpt-5.6-luna',
				name: 'GPT-5.6 Luna',
				category: 'premium',
				reasoningSupported: true,
				reasoningEfforts: ['low', 'medium']
			})
		).toBe('low');
		expect(
			modelReasoningEffort({
				id: 'openrouter/free',
				name: 'OpenRouter Free',
				category: 'free',
				reasoningSupported: true,
				reasoningEfforts: ['low']
			})
		).toBeNull();
	});
});
