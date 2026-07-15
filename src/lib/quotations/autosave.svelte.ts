import { isQuotationConflict, quotationErrorInfo, type QuotationErrorInfo } from './errors';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export interface AutosaveSaveResult<TDocument> {
	document: TDocument;
	lockVersion: number;
}

export interface AutosaveConflict<TDocument> {
	localDocument: TDocument;
	serverDocument?: TDocument;
	serverLockVersion?: number;
	message: string;
}

export interface QuotationAutosaveOptions<TDocument> {
	initialDocument: TDocument;
	initialLockVersion: number;
	save: (
		document: TDocument,
		expectedLockVersion: number,
		signal: AbortSignal
	) => Promise<AutosaveSaveResult<TDocument>>;
	debounceMs?: number;
}

interface ConflictDetails<TDocument> {
	document?: TDocument;
	lockVersion?: number;
}

export class QuotationAutosave<TDocument> {
	status = $state<AutosaveStatus>('idle');
	document = $state.raw<TDocument>(undefined as TDocument);
	lockVersion = $state(0);
	error = $state.raw<QuotationErrorInfo | null>(null);
	conflict = $state.raw<AutosaveConflict<TDocument> | null>(null);

	readonly #save: QuotationAutosaveOptions<TDocument>['save'];
	readonly #debounceMs: number;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#pendingDocument: TDocument | null = null;
	#revision = 0;
	#activeRequest = 0;
	#controller: AbortController | null = null;
	#inFlight: Promise<void> | null = null;
	#disposed = false;

	constructor(options: QuotationAutosaveOptions<TDocument>) {
		this.document = options.initialDocument;
		this.lockVersion = options.initialLockVersion;
		this.#save = options.save;
		this.#debounceMs = options.debounceMs ?? 1_000;
	}

	schedule(document: TDocument): void {
		if (this.#disposed) return;
		this.document = document;
		this.#pendingDocument = document;
		this.#revision += 1;
		this.error = null;
		this.conflict = null;
		this.status = 'dirty';
		this.#scheduleTimer();
	}

	async flush(): Promise<void> {
		if (this.#disposed || this.status === 'conflict') return;
		this.#clearTimer();
		await this.#savePending();
	}

	/** Accept the latest server value and explicitly discard the local conflict copy. */
	resolveWithServer(document?: TDocument, lockVersion?: number): void {
		const serverDocument = document ?? this.conflict?.serverDocument;
		const serverLockVersion = lockVersion ?? this.conflict?.serverLockVersion;
		if (serverDocument === undefined || serverLockVersion === undefined) {
			throw new Error('Do rozwiązania konfliktu potrzebna jest aktualna wersja z serwera.');
		}
		this.#invalidateActiveRequest();
		this.document = serverDocument;
		this.lockVersion = serverLockVersion;
		this.#pendingDocument = null;
		this.error = null;
		this.conflict = null;
		this.status = 'saved';
	}

	/** Keep the local value, but retry only against an explicitly supplied latest server lock. */
	resolveWithLocal(serverLockVersion?: number): void {
		const latestLockVersion = serverLockVersion ?? this.conflict?.serverLockVersion;
		const localDocument = this.conflict ? this.conflict.localDocument : this.document;
		if (latestLockVersion === undefined) {
			throw new Error('Do ponownego zapisu potrzebna jest aktualna wersja blokady z serwera.');
		}
		this.#invalidateActiveRequest();
		this.lockVersion = latestLockVersion;
		this.conflict = null;
		this.error = null;
		this.schedule(localDocument);
	}

	/** Replace state after an external reload and invalidate every late in-flight response. */
	replaceFromServer(document: TDocument, lockVersion: number): void {
		this.#invalidateActiveRequest();
		this.document = document;
		this.lockVersion = lockVersion;
		this.#pendingDocument = null;
		this.error = null;
		this.conflict = null;
		this.status = 'saved';
	}

	dispose(): void {
		this.#disposed = true;
		this.#invalidateActiveRequest();
	}

	#scheduleTimer(): void {
		this.#clearTimer();
		this.#timer = setTimeout(() => {
			this.#timer = null;
			void this.#savePending();
		}, this.#debounceMs);
	}

	async #savePending(): Promise<void> {
		if (this.#disposed || this.status === 'conflict' || this.#pendingDocument === null) return;
		if (this.#inFlight) {
			await this.#inFlight;
			if (!this.#disposed && this.#pendingDocument !== null) {
				await this.#savePending();
			}
			return;
		}

		const operation = this.#performSave();
		this.#inFlight = operation;
		try {
			await operation;
		} finally {
			if (this.#inFlight === operation) this.#inFlight = null;
		}
	}

	async #performSave(): Promise<void> {
		const document = this.#pendingDocument;
		if (document === null) return;
		const revision = this.#revision;
		const expectedLockVersion = this.lockVersion;
		const request = ++this.#activeRequest;
		this.#controller = new AbortController();
		this.status = 'saving';
		this.error = null;

		try {
			const result = await this.#save(document, expectedLockVersion, this.#controller.signal);
			if (!this.#isCurrent(request)) return;

			// Even when the user edited during the request, this confirmed save advances
			// the lock used by the next serialized request.
			this.lockVersion = Math.max(this.lockVersion, result.lockVersion);
			if (revision === this.#revision) {
				this.document = result.document;
				this.#pendingDocument = null;
				this.status = 'saved';
			} else {
				this.status = 'dirty';
				this.#scheduleTimer();
			}
		} catch (cause) {
			if (!this.#isCurrent(request) || isAbortError(cause)) return;
			const info = quotationErrorInfo(cause);
			this.error = info;
			if (isQuotationConflict(cause)) {
				const details = conflictDetails<TDocument>(cause);
				this.conflict = {
					localDocument: this.#pendingDocument ?? document,
					...(details.document !== undefined ? { serverDocument: details.document } : {}),
					...(details.lockVersion !== undefined ? { serverLockVersion: details.lockVersion } : {}),
					message: info.message
				};
				this.status = 'conflict';
			} else {
				this.status = 'error';
			}
		} finally {
			if (this.#isCurrent(request)) this.#controller = null;
		}
	}

	#isCurrent(request: number): boolean {
		return !this.#disposed && request === this.#activeRequest;
	}

	#clearTimer(): void {
		if (this.#timer !== null) clearTimeout(this.#timer);
		this.#timer = null;
	}

	#invalidateActiveRequest(): void {
		this.#clearTimer();
		this.#activeRequest += 1;
		this.#controller?.abort();
		this.#controller = null;
	}
}

function conflictDetails<TDocument>(error: unknown): ConflictDetails<TDocument> {
	if (!error || typeof error !== 'object') return {};
	const details = (error as { details?: unknown }).details;
	if (!details || typeof details !== 'object') return {};
	const value = details as { document?: unknown; lockVersion?: unknown };
	return {
		...(value.document !== undefined ? { document: value.document as TDocument } : {}),
		...(typeof value.lockVersion === 'number' ? { lockVersion: value.lockVersion } : {})
	};
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
