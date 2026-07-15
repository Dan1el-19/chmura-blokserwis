import { json } from '@sveltejs/kit';
import type {
	CreateQuotationRequest,
	QuotationDraftInput,
	QuotationStatus
} from '@unisource/sdk/v2';

import type { ImportedQuotationItem } from '$lib/quotations/types';

import { unisourceErrorResponse } from './unisource-errors';

type JsonRecord = Record<string, unknown>;

export function requireQuotationUser(locals: App.Locals): Response | null {
	return locals.user ? null : json({ error: 'Unauthorized' }, { status: 401 });
}

export async function readQuotationJson(request: Request): Promise<JsonRecord | Response> {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ error: 'Nieprawidłowe dane żądania.' }, { status: 400 });
	}
	return body as JsonRecord;
}

export function quotationErrorResponse(error: unknown, fallback: string): Response {
	return unisourceErrorResponse(error, fallback);
}

export function quotationIdempotencyKey(request: Request, body?: JsonRecord): string {
	const fromHeader = request.headers.get('Idempotency-Key')?.trim();
	const fromBody = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
	return fromHeader || fromBody || crypto.randomUUID();
}

export function withoutProxyFields<T extends JsonRecord>(
	body: T
): Omit<T, 'idempotencyKey' | 'localDraftId'> {
	const input = { ...body };
	delete input.idempotencyKey;
	delete input.localDraftId;
	return input;
}

export function parseQuotationListQuery(url: URL) {
	const rawYear = url.searchParams.get('year');
	const rawLimit = url.searchParams.get('limit');
	const rawStatus = url.searchParams.get('status');
	const year = rawYear ? Number(rawYear) : undefined;
	const limit = rawLimit ? Number(rawLimit) : 50;
	const status = ['draft', 'approved', 'archived'].includes(rawStatus ?? '')
		? (rawStatus as QuotationStatus)
		: undefined;

	return {
		search: url.searchParams.get('search')?.trim() || undefined,
		year: Number.isInteger(year) && year! >= 2000 && year! <= 9999 ? year : undefined,
		status,
		cursor: url.searchParams.get('cursor') || undefined,
		limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 50
	};
}

export function normalizeCreateQuotation(body: JsonRecord): CreateQuotationRequest {
	const envelope =
		body.localDraft && typeof body.localDraft === 'object' && !Array.isArray(body.localDraft)
			? (body.localDraft as JsonRecord)
			: body;
	const source =
		envelope.document && typeof envelope.document === 'object' && !Array.isArray(envelope.document)
			? {
					...(envelope.document as JsonRecord),
					knowledgeEnabled: envelope.knowledgeEnabled
				}
			: envelope;
	const localItems = Array.isArray(source.items) ? source.items : [];
	const alreadyStructured =
		Array.isArray(source.categories) &&
		localItems.every((item) => Boolean(item && typeof item === 'object' && 'categoryId' in item));

	if (alreadyStructured) {
		const draft = { ...source };
		delete draft.number;
		delete draft.issuedAt;
		delete draft.documentRevision;
		delete draft.totalGrossCents;
		return withoutProxyFields(draft) as CreateQuotationRequest;
	}

	const imported = localItems as unknown as ImportedQuotationItem[];
	const title =
		typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'Nowa wycena';
	const categoryNames = [
		...new Set(imported.map((item) => item.categoryTitle?.trim() || 'Pozostałe'))
	];
	if (categoryNames.length === 0) categoryNames.push('Pozycje wyceny');
	const categories = categoryNames.map((categoryTitle, index) => ({
		id: stableId('category', categoryTitle, index),
		title: categoryTitle,
		sortOrder: index
	}));
	const categoryByTitle = new Map(categories.map((category) => [category.title, category.id]));
	const fallbackCategoryId = categories[0].id;
	const items =
		imported.length > 0
			? imported.map((item, index) => ({
					id: item.id || stableId('item', item.name, index),
					name: item.name,
					...(item.shortDescription ? { shortDescription: item.shortDescription } : {}),
					quantity: item.quantity,
					unit: item.unit || 'szt.',
					unitGrossCents: item.unitGrossCents,
					categoryId:
						categoryByTitle.get(item.categoryTitle?.trim() || 'Pozostałe') ?? fallbackCategoryId,
					sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index
				}))
			: [
					{
						id: stableId('item', title, 0),
						name: 'Nowa pozycja',
						quantity: 1,
						unit: 'szt.',
						unitGrossCents: 0,
						categoryId: fallbackCategoryId,
						sortOrder: 0
					}
				];

	return {
		title,
		letterheadVariant: isLetterhead(source.letterheadVariant)
			? source.letterheadVariant
			: 'orange_axis',
		customer: isRecord(source.customer) ? source.customer : {},
		introduction: typeof source.introduction === 'string' ? source.introduction : '',
		categories,
		items,
		descriptionSectionTitle:
			typeof source.descriptionSectionTitle === 'string' && source.descriptionSectionTitle.trim()
				? source.descriptionSectionTitle
				: 'Opis oferty',
		descriptionBlocks: Array.isArray(source.descriptionBlocks) ? source.descriptionBlocks : [],
		...(typeof source.customNote === 'string' ? { customNote: source.customNote } : {}),
		...(typeof source.knowledgeEnabled === 'boolean'
			? { knowledgeEnabled: source.knowledgeEnabled }
			: {})
	} as CreateQuotationRequest;
}

function stableId(prefix: string, value: string, index: number): string {
	const slug = value
		.toLocaleLowerCase('pl')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
	return `${prefix}-${index + 1}-${slug || 'pozycja'}`;
}

function isLetterhead(value: unknown): value is QuotationDraftInput['letterheadVariant'] {
	return value === 'orange_axis' || value === 'technical_grid' || value === 'module_b';
}

function isRecord(value: unknown): value is Record<string, string> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
