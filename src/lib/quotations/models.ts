import type { QuotationModelPrice } from './types';

export const QUOTATION_AI_MODEL_ID = 'openai/gpt-5.6-luna';

export const QUOTATION_MODEL_CATEGORIES = [
	'free',
	'fast',
	'standard',
	'premium',
	'premium_anthropic'
] as const;

export type QuotationModelCategory = (typeof QUOTATION_MODEL_CATEGORIES)[number];
export type QuotationAiAction = 'generate' | 'revise_block';

export const QUOTATION_MODEL_CATEGORY_META: Record<
	QuotationModelCategory,
	{ label: string; fallbackUseCase: string; fallbackId: string }
> = {
	free: {
		label: 'Free',
		fallbackUseCase: 'Automatyczny darmowy routing OpenRouter',
		fallbackId: 'openrouter/free'
	},
	fast: {
		label: 'Szybki',
		fallbackUseCase: 'Poprawki, review i krótkie iteracje',
		fallbackId: 'deepseek/deepseek-v4-flash'
	},
	standard: {
		label: 'Standardowy',
		fallbackUseCase: 'Domyślny model do kompletnego generowania',
		fallbackId: 'deepseek/deepseek-v4-pro'
	},
	premium: {
		label: 'Premium',
		fallbackUseCase: 'Najwyższa jakość wybierana ręcznie',
		fallbackId: 'openai/gpt-5.6-luna'
	},
	premium_anthropic: {
		label: 'Premium Anthropic',
		fallbackUseCase: 'Alternatywny model premium wybierany ręcznie',
		fallbackId: 'anthropic/claude-haiku-4.5'
	}
};

export function quotationModelCategory(model: QuotationModelPrice): QuotationModelCategory | null {
	if (isQuotationModelCategory(model.category)) return model.category;

	const id = model.id.toLocaleLowerCase('en');
	const name = model.name.toLocaleLowerCase('en');
	for (const category of QUOTATION_MODEL_CATEGORIES) {
		if (id === QUOTATION_MODEL_CATEGORY_META[category].fallbackId) return category;
	}
	if (id === 'openrouter/free' || name.includes('free') || name.includes('darmow')) return 'free';
	if (id.includes('v4-flash') || name.includes('v4 flash')) return 'fast';
	if (id.includes('v4-pro') || name.includes('v4 pro')) return 'standard';
	if (id.includes('gpt-5.6-luna') || name.includes('luna')) return 'premium';
	if (id.includes('claude-haiku-4.5') || name.includes('haiku 4.5')) return 'premium_anthropic';
	return null;
}

export function quotationModelForCategory(
	models: QuotationModelPrice[],
	category: QuotationModelCategory
): QuotationModelPrice | undefined {
	return models.find((model) => quotationModelCategory(model) === category);
}

export function quotationModelForAction(
	models: QuotationModelPrice[],
	action: QuotationAiAction
): QuotationModelPrice | undefined {
	const declared = models.find(
		(model) => model.available !== false && modelDefaultsFor(model, action)
	);
	if (declared) return declared;
	const fallback = quotationModelForCategory(models, action === 'generate' ? 'standard' : 'fast');
	return fallback?.available === false ? undefined : fallback;
}

export function modelReasoningEffort(model: QuotationModelPrice | undefined): string | null {
	if (!model || model.available === false || quotationModelCategory(model) === 'free') return null;
	if (model.reasoningSupported === false) return null;
	const efforts = Array.isArray(model.reasoningEfforts)
		? model.reasoningEfforts.filter((effort): effort is string => typeof effort === 'string')
		: [];
	const category = quotationModelCategory(model);
	if (category === 'premium' || category === 'premium_anthropic') {
		return efforts.includes('low') || efforts.length === 0 ? 'low' : efforts[0];
	}
	return efforts.includes('high') || efforts.length === 0 ? 'high' : efforts[0];
}

function modelDefaultsFor(model: QuotationModelPrice, action: QuotationAiAction): boolean {
	const declared = model.defaultFor;
	if (Array.isArray(declared)) return declared.includes(action);
	return declared === action;
}

function isQuotationModelCategory(value: unknown): value is QuotationModelCategory {
	return QUOTATION_MODEL_CATEGORIES.includes(value as QuotationModelCategory);
}
