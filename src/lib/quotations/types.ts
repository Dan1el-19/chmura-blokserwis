export type MoneyCents = number;

export type LetterheadVariant = 'orange_axis' | 'technical_grid' | 'module_b';
export type QuotationDescriptionSource = 'manual' | 'ai' | 'product_knowledge';

export interface QuotationCustomer {
	companyName?: string;
	contactName?: string;
	address?: string;
	taxId?: string;
	email?: string;
	phone?: string;
}

export interface QuotationCategoryInput {
	id: string;
	title: string;
	sortOrder?: number;
}

export interface QuotationItemInput {
	id: string;
	name: string;
	shortDescription?: string;
	quantity: number;
	unit: string;
	unitGrossCents: MoneyCents;
	categoryId: string;
	sortOrder?: number;
}

export interface QuotationDescriptionBlockInput {
	id: string;
	label: string;
	title: string;
	content: string;
	relatedItemIds: string[];
	sortOrder?: number;
	source: QuotationDescriptionSource;
}

/** Payload accepted by UniSource. Calculated totals intentionally do not belong here. */
export interface QuotationDraftInput {
	schemaVersion?: 1;
	letterheadVariant?: LetterheadVariant;
	title: string;
	customer?: QuotationCustomer;
	introduction?: string;
	categories: QuotationCategoryInput[];
	items: QuotationItemInput[];
	descriptionSectionTitle?: string;
	descriptionSectionIntro?: string;
	descriptionBlocks?: QuotationDescriptionBlockInput[];
	customNote?: string;
	knowledgeEnabled?: boolean;
}

export interface UpdateQuotationPayload extends Partial<QuotationDraftInput> {
	expectedLockVersion: number;
}

export interface QuotationModelPrice {
	id: string;
	name: string;
	description?: string;
	category?: string;
	useCase?: string;
	defaultFor?: string | string[];
	reasoningSupported?: boolean;
	reasoningEfforts?: string[];
	promptPriceUsd?: string;
	completionPriceUsd?: string;
	recommended?: boolean;
	available?: boolean;
}

export type QuotationImportField =
	| 'name'
	| 'quantity'
	| 'unitGross'
	| 'shortDescription'
	| 'unit'
	| 'category'
	| 'comparisonTotalGross';

export type QuotationColumnMapping = Partial<Record<QuotationImportField, number>>;

export type QuotationImportIssueField = QuotationImportField | 'row';

export interface QuotationImportIssue {
	rowNumber: number;
	field: QuotationImportIssueField;
	message: string;
}

/**
 * Client-side draft item produced by XLSX import. The backend remains the source
 * of truth and recalculates totals when the draft is saved.
 */
export interface ImportedQuotationItem {
	id: string;
	name: string;
	shortDescription?: string;
	quantity: number;
	unit: string;
	unitGrossCents: MoneyCents;
	totalGrossCents: MoneyCents;
	categoryTitle?: string;
	sortOrder: number;
	sourceRowNumber: number;
	/** Fields that need correction before this row can be sent to UniSource. */
	invalidFields?: QuotationImportField[];
}

export interface QuotationSheetSummary {
	name: string;
	nonEmptyRowCount: number;
	canImport: boolean;
}

export interface QuotationWorkbookImport {
	sheets: QuotationSheetSummary[];
	selectedSheetName: string;
	headerRowNumber: number;
	headers: string[];
	mapping: QuotationColumnMapping;
	items: ImportedQuotationItem[];
	issues: QuotationImportIssue[];
	totalGrossCents: MoneyCents;
}
