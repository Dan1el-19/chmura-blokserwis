import type { QuotationModelPrice } from './types';

export const DEFAULT_AI_PROMPT_TOKENS = 3_000;
export const DEFAULT_AI_COMPLETION_TOKENS = 1_500;
export const DEFAULT_AI_REASONING_COMPLETION_TOKENS = 3_000;

export interface QuotationAiCostEstimate {
	promptTokens: number;
	completionTokens: number;
	promptCostUsdMicros: number;
	completionCostUsdMicros: number;
	totalCostUsdMicros: number;
	isExact: false;
}

export function estimateQuotationAiCost(
	model: QuotationModelPrice,
	options: {
		promptTokens?: number;
		completionTokens?: number;
		reasoningEnabled?: boolean;
	} = {}
): QuotationAiCostEstimate | null {
	const promptPrice = parseUsdPerToken(model.promptPriceUsd);
	const completionPrice = parseUsdPerToken(model.completionPriceUsd);
	if (promptPrice === null || completionPrice === null) return null;

	const promptTokens = tokenCount(options.promptTokens, DEFAULT_AI_PROMPT_TOKENS);
	const completionTokens = tokenCount(
		options.completionTokens,
		options.reasoningEnabled ? DEFAULT_AI_REASONING_COMPLETION_TOKENS : DEFAULT_AI_COMPLETION_TOKENS
	);
	const promptCostUsdMicros = Math.round(promptTokens * promptPrice * 1_000_000);
	const completionCostUsdMicros = Math.round(completionTokens * completionPrice * 1_000_000);

	return {
		promptTokens,
		completionTokens,
		promptCostUsdMicros,
		completionCostUsdMicros,
		totalCostUsdMicros: promptCostUsdMicros + completionCostUsdMicros,
		isExact: false
	};
}

/** A predictable text heuristic for showing a pre-flight estimate before generation. */
export function estimateTokenCount(text: string): number {
	const trimmed = text.trim();
	return trimmed ? Math.max(1, Math.ceil(trimmed.length / 4)) : 0;
}

export function formatUsdMicros(costUsdMicros: number, locale = 'pl-PL'): string {
	const usd = Math.max(0, Math.round(costUsdMicros)) / 1_000_000;
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: usd < 0.01 ? 4 : 2,
		maximumFractionDigits: usd < 0.01 ? 6 : 2
	}).format(usd);
}

function parseUsdPerToken(value: string | undefined): number | null {
	if (value === undefined || value.trim() === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function tokenCount(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) && value !== undefined && value >= 0 ? Math.round(value) : fallback;
}
