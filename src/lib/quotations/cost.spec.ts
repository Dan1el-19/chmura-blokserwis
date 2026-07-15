import { describe, expect, it } from 'vitest';
import { estimateQuotationAiCost, estimateTokenCount, formatUsdMicros } from './cost';

describe('quotation AI cost', () => {
	it('estimates prompt and completion cost from OpenRouter per-token prices', () => {
		const estimate = estimateQuotationAiCost(
			{
				id: 'free-or-cheap',
				name: 'Model',
				promptPriceUsd: '0.000001',
				completionPriceUsd: '0.000002'
			},
			{ promptTokens: 2_000, completionTokens: 500 }
		);

		expect(estimate).toEqual({
			promptTokens: 2_000,
			completionTokens: 500,
			promptCostUsdMicros: 2_000,
			completionCostUsdMicros: 1_000,
			totalCostUsdMicros: 3_000,
			isExact: false
		});
	});

	it('supports free models and rejects unavailable pricing', () => {
		expect(
			estimateQuotationAiCost({
				id: 'free',
				name: 'Free',
				promptPriceUsd: '0',
				completionPriceUsd: '0'
			})?.totalCostUsdMicros
		).toBe(0);
		expect(estimateQuotationAiCost({ id: 'unknown', name: 'Unknown' })).toBeNull();
		expect(
			estimateQuotationAiCost({
				id: 'bad',
				name: 'Bad',
				promptPriceUsd: '-1',
				completionPriceUsd: '0'
			})
		).toBeNull();
	});

	it('uses a conservative completion budget when reasoning is enabled', () => {
		const estimate = estimateQuotationAiCost(
			{
				id: 'reasoning-model',
				name: 'Reasoning model',
				promptPriceUsd: '0.000001',
				completionPriceUsd: '0.000002'
			},
			{ reasoningEnabled: true }
		);

		expect(estimate).toMatchObject({
			promptTokens: 3_000,
			completionTokens: 3_000,
			totalCostUsdMicros: 9_000,
			isExact: false
		});
	});

	it('provides stable token and localized display helpers', () => {
		expect(estimateTokenCount('12345678')).toBe(2);
		expect(estimateTokenCount('')).toBe(0);
		expect(formatUsdMicros(3_000)).toContain('0,003');
	});
});
