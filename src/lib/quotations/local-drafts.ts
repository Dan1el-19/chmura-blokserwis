import { importedItemsToQuotationDraft } from './document';
import type { ImportedQuotationItem, QuotationDraftInput } from './types';

export const LOCAL_QUOTATION_DRAFTS_KEY = 'blokserwis:quotation-drafts:v1';

export interface LocalQuotationDraft {
	id: string;
	title: string;
	status: 'draft';
	createdAt: string;
	updatedAt: string;
	items: ImportedQuotationItem[];
	totalGrossCents: number;
}

export interface NewLocalQuotationDraft {
	id?: string;
	title: string;
	items: ImportedQuotationItem[];
	now?: string;
}

export function listLocalQuotationDrafts(storage: Pick<Storage, 'getItem'>): LocalQuotationDraft[] {
	const raw = storage.getItem(LOCAL_QUOTATION_DRAFTS_KEY);
	if (!raw) return [];

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter(isLocalQuotationDraft)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	} catch {
		return [];
	}
}

export function createLocalQuotationDraft(input: NewLocalQuotationDraft): LocalQuotationDraft {
	const now = input.now ?? new Date().toISOString();
	return {
		id: input.id ?? globalThis.crypto.randomUUID(),
		title: input.title.trim() || 'Nowa wycena',
		status: 'draft',
		createdAt: now,
		updatedAt: now,
		items: input.items,
		totalGrossCents: input.items.reduce((sum, item) => sum + item.totalGrossCents, 0)
	};
}

export function saveLocalQuotationDraft(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	draft: LocalQuotationDraft
): void {
	const drafts = listLocalQuotationDrafts(storage).filter((item) => item.id !== draft.id);
	storage.setItem(LOCAL_QUOTATION_DRAFTS_KEY, JSON.stringify([draft, ...drafts]));
}

export function removeLocalQuotationDraft(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	draftId: string
): void {
	const remaining = listLocalQuotationDrafts(storage).filter((draft) => draft.id !== draftId);
	storage.setItem(LOCAL_QUOTATION_DRAFTS_KEY, JSON.stringify(remaining));
}

export interface LocalDraftMigrationFailure {
	draft: LocalQuotationDraft;
	error: unknown;
}

export interface LocalDraftMigrationResult<T> {
	migrated: Array<{ draft: LocalQuotationDraft; result: T }>;
	failed: LocalDraftMigrationFailure[];
}

/**
 * Migrates sequentially so every local draft is removed only after UniSource
 * has confirmed creation. Failed and not-yet-migrated drafts stay recoverable.
 */
export async function migrateLocalQuotationDrafts<T>(
	storage: Pick<Storage, 'getItem' | 'setItem'>,
	createRemote: (payload: QuotationDraftInput, localDraft: LocalQuotationDraft) => Promise<T>
): Promise<LocalDraftMigrationResult<T>> {
	const migrated: LocalDraftMigrationResult<T>['migrated'] = [];
	const failed: LocalDraftMigrationFailure[] = [];

	for (const draft of listLocalQuotationDrafts(storage)) {
		try {
			const payload = importedItemsToQuotationDraft(draft.title, draft.items);
			const result = await createRemote(payload, draft);
			removeLocalQuotationDraft(storage, draft.id);
			migrated.push({ draft, result });
		} catch (error) {
			failed.push({ draft, error });
		}
	}

	return { migrated, failed };
}

function isLocalQuotationDraft(value: unknown): value is LocalQuotationDraft {
	if (!value || typeof value !== 'object') return false;
	const draft = value as Partial<LocalQuotationDraft>;
	return (
		typeof draft.id === 'string' &&
		typeof draft.title === 'string' &&
		draft.status === 'draft' &&
		typeof draft.createdAt === 'string' &&
		typeof draft.updatedAt === 'string' &&
		Array.isArray(draft.items) &&
		typeof draft.totalGrossCents === 'number'
	);
}
