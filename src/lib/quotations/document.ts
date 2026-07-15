import type {
	ImportedQuotationItem,
	QuotationCategoryInput,
	QuotationDescriptionBlockInput,
	QuotationDraftInput,
	QuotationItemInput,
	UpdateQuotationPayload
} from './types';

export const DEFAULT_QUOTATION_CATEGORY_TITLE = 'Pozostałe';
export const DEFAULT_QUOTATION_SECTION_TITLE = 'Opis zakresu';

export interface CreateManualDraftOptions {
	title?: string;
	id?: () => string;
}

type DraftSource = QuotationDraftInput & {
	number?: string;
	issuedAt?: string;
	documentRevision?: number;
	totalGrossCents?: number;
	items: Array<QuotationItemInput & { totalGrossCents?: number }>;
};

export function createManualQuotationDraft(
	options: CreateManualDraftOptions = {}
): QuotationDraftInput {
	const id = options.id ?? createId;
	const categoryId = id();

	return normalizeQuotationDraft({
		schemaVersion: 1,
		letterheadVariant: 'orange_axis',
		title: options.title ?? 'Nowa wycena',
		customer: {},
		introduction: '',
		categories: [{ id: categoryId, title: DEFAULT_QUOTATION_CATEGORY_TITLE }],
		items: [
			{
				id: id(),
				name: 'Nowa pozycja',
				quantity: 1,
				unit: 'szt.',
				unitGrossCents: 0,
				categoryId
			}
		],
		descriptionSectionTitle: DEFAULT_QUOTATION_SECTION_TITLE,
		descriptionBlocks: []
	});
}

export function importedItemsToQuotationDraft(
	title: string,
	importedItems: ImportedQuotationItem[],
	options: { id?: () => string } = {}
): QuotationDraftInput {
	if (importedItems.length === 0) {
		throw new Error('Wycena musi zawierać co najmniej jedną pozycję.');
	}

	const id = options.id ?? createId;
	const categoriesByLabel = new Map<string, QuotationCategoryInput>();
	const categories: QuotationCategoryInput[] = [];
	const items = importedItems.map((item, index): QuotationItemInput => {
		const categoryTitle = cleanText(item.categoryTitle) || DEFAULT_QUOTATION_CATEGORY_TITLE;
		const categoryKey = normalizedLabel(categoryTitle);
		let category = categoriesByLabel.get(categoryKey);
		if (!category) {
			category = { id: id(), title: categoryTitle, sortOrder: categories.length };
			categoriesByLabel.set(categoryKey, category);
			categories.push(category);
		}

		return {
			id: cleanText(item.id) || id(),
			name: cleanText(item.name) || 'Pozycja bez nazwy',
			...(cleanText(item.shortDescription)
				? { shortDescription: cleanText(item.shortDescription) }
				: {}),
			quantity: positiveQuantity(item.quantity),
			unit: cleanText(item.unit) || 'szt.',
			unitGrossCents: nonNegativeInteger(item.unitGrossCents),
			categoryId: category.id,
			sortOrder: index
		};
	});

	return normalizeQuotationDraft({
		schemaVersion: 1,
		letterheadVariant: 'orange_axis',
		title,
		customer: {},
		introduction: '',
		categories,
		items,
		descriptionSectionTitle: DEFAULT_QUOTATION_SECTION_TITLE,
		descriptionBlocks: []
	});
}

/**
 * Produces the canonical client payload: categories are merged by normalized
 * label, ordering is dense and backend-calculated totals are never copied.
 */
export function normalizeQuotationDraft(source: DraftSource): QuotationDraftInput {
	if (source.items.length === 0) {
		throw new Error('Wycena musi zawierać co najmniej jedną pozycję.');
	}

	const usedCategoryIds = new Set<string>();
	const categoriesBySourceId = new Map<string, QuotationCategoryInput>();
	const categoriesByLabel = new Map<string, QuotationCategoryInput>();
	const categories: QuotationCategoryInput[] = [];

	for (const sourceCategory of [...source.categories].sort(bySortOrder)) {
		const title = cleanText(sourceCategory.title) || DEFAULT_QUOTATION_CATEGORY_TITLE;
		const key = normalizedLabel(title);
		let category = categoriesByLabel.get(key);
		if (!category) {
			const preferredId = cleanText(sourceCategory.id);
			const categoryId = uniqueId(
				preferredId || `category-${categories.length + 1}`,
				usedCategoryIds
			);
			category = { id: categoryId, title, sortOrder: categories.length };
			categories.push(category);
			categoriesByLabel.set(key, category);
		}
		categoriesBySourceId.set(sourceCategory.id, category);
	}

	function fallbackCategory(): QuotationCategoryInput {
		const key = normalizedLabel(DEFAULT_QUOTATION_CATEGORY_TITLE);
		let category = categoriesByLabel.get(key);
		if (!category) {
			category = {
				id: uniqueId('category-other', usedCategoryIds),
				title: DEFAULT_QUOTATION_CATEGORY_TITLE,
				sortOrder: categories.length
			};
			categories.push(category);
			categoriesByLabel.set(key, category);
		}
		return category;
	}

	const usedItemIds = new Set<string>();
	const itemIdMap = new Map<string, string>();
	const items = [...source.items].sort(bySortOrder).map((sourceItem, index): QuotationItemInput => {
		const itemId = uniqueId(cleanText(sourceItem.id) || `item-${index + 1}`, usedItemIds);
		itemIdMap.set(sourceItem.id, itemId);
		const category = categoriesBySourceId.get(sourceItem.categoryId) ?? fallbackCategory();
		return {
			id: itemId,
			name: cleanText(sourceItem.name) || 'Pozycja bez nazwy',
			...(cleanText(sourceItem.shortDescription)
				? { shortDescription: cleanText(sourceItem.shortDescription) }
				: {}),
			quantity: positiveQuantity(sourceItem.quantity),
			unit: cleanText(sourceItem.unit) || 'szt.',
			unitGrossCents: nonNegativeInteger(sourceItem.unitGrossCents),
			categoryId: category.id,
			sortOrder: index
		};
	});

	const usedBlockIds = new Set<string>();
	const itemIds = new Set(items.map((item) => item.id));
	const descriptionBlocks = [...(source.descriptionBlocks ?? [])].sort(bySortOrder).map(
		(block, index): QuotationDescriptionBlockInput => ({
			id: uniqueId(cleanText(block.id) || `block-${index + 1}`, usedBlockIds),
			label: cleanText(block.label) || `Sekcja ${index + 1}`,
			title: cleanText(block.title) || 'Opis',
			content: cleanText(block.content) || 'Brak opisu.',
			relatedItemIds: [
				...new Set(block.relatedItemIds.map((id) => itemIdMap.get(id) ?? id))
			].filter((id) => itemIds.has(id)),
			sortOrder: index,
			source: block.source
		})
	);

	return {
		schemaVersion: 1,
		letterheadVariant: source.letterheadVariant ?? 'orange_axis',
		title: cleanText(source.title) || 'Nowa wycena',
		customer: normalizeCustomer(source.customer),
		introduction: source.introduction?.trim() ?? '',
		categories,
		items,
		descriptionSectionTitle:
			cleanText(source.descriptionSectionTitle) || DEFAULT_QUOTATION_SECTION_TITLE,
		...(cleanText(source.descriptionSectionIntro)
			? { descriptionSectionIntro: cleanText(source.descriptionSectionIntro) }
			: {}),
		descriptionBlocks,
		...(cleanText(source.customNote) ? { customNote: cleanText(source.customNote) } : {}),
		...(typeof source.knowledgeEnabled === 'boolean'
			? { knowledgeEnabled: source.knowledgeEnabled }
			: {})
	};
}

export function quotationDocumentToUpdatePayload(
	document: DraftSource,
	expectedLockVersion: number
): UpdateQuotationPayload {
	return { ...normalizeQuotationDraft(document), expectedLockVersion };
}

function normalizeCustomer(
	customer: DraftSource['customer']
): NonNullable<QuotationDraftInput['customer']> {
	if (!customer) return {};
	return Object.fromEntries(
		Object.entries(customer)
			.map(([key, value]) => [key, value?.trim()])
			.filter((entry): entry is [string, string] => Boolean(entry[1]))
	);
}

function bySortOrder(a: { sortOrder?: number }, b: { sortOrder?: number }): number {
	return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

function cleanText(value: string | undefined): string {
	return value?.trim() ?? '';
}

function normalizedLabel(value: string): string {
	return value
		.toLocaleLowerCase('pl-PL')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function positiveQuantity(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) / 1000 : 1;
}

function nonNegativeInteger(value: number): number {
	return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function uniqueId(preferred: string, used: Set<string>): string {
	let id = preferred;
	let suffix = 2;
	while (used.has(id)) id = `${preferred}-${suffix++}`;
	used.add(id);
	return id;
}

function createId(): string {
	return globalThis.crypto.randomUUID();
}
