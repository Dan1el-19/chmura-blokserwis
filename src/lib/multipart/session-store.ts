import type { UploadMode } from '../gen/unisourcecfl/upload/v1/upload_pb.js';

export type PersistedMultipartPart = {
	partNumber: number;
	sizeBytes: number;
	sha256Hex: string;
	md5Base64: string;
	targetOperation?: {
		attemptId: string;
		requestId: string;
		expectedRevision: bigint;
		operationId?: string;
		generation?: bigint;
	};
};

export type PersistedMultipartPhase =
	| 'preparing'
	| 'beginning'
	| 'uploading'
	| 'paused'
	| 'verifying'
	| 'completed'
	| 'cancelled'
	| 'failed';

export type PersistedMultipartSession = {
	ownerId: string;
	localId: string;
	requestId: string;
	uploadId?: string;
	spaceId: string;
	targetLabel?: string;
	parentId?: string;
	name: string;
	replaceEntryId?: string;
	replaceExpectedRevision?: number;
	sizeBytes: number;
	partSizeBytes: number;
	maxParallelParts?: number;
	fingerprintHex: string;
	parts: PersistedMultipartPart[];
	uploadMode: UploadMode;
	attemptId?: string;
	attemptNumber: number;
	revision: bigint;
	expiresAtEpochMs?: number;
	fallbackUsed?: boolean;
	failureCode?: string;
	readyForParts?: boolean;
	phase: PersistedMultipartPhase;
};

export interface MultipartSessionStore {
	put(session: PersistedMultipartSession): Promise<void>;
	get(ownerId: string, localId: string): Promise<PersistedMultipartSession | undefined>;
	list(ownerId: string): Promise<PersistedMultipartSession[]>;
	delete(ownerId: string, localId: string): Promise<void>;
}

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
		transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
	});
}

function copySafeFields(session: PersistedMultipartSession): PersistedMultipartSession {
	return {
		ownerId: session.ownerId,
		localId: session.localId,
		requestId: session.requestId,
		...(session.uploadId ? { uploadId: session.uploadId } : {}),
		spaceId: session.spaceId,
		...(session.targetLabel ? { targetLabel: session.targetLabel } : {}),
		...(session.parentId ? { parentId: session.parentId } : {}),
		name: session.name,
		...(session.replaceEntryId !== undefined ? { replaceEntryId: session.replaceEntryId, replaceExpectedRevision: session.replaceExpectedRevision } : {}),
		sizeBytes: session.sizeBytes,
		partSizeBytes: session.partSizeBytes,
		...(session.maxParallelParts === undefined ? {} : { maxParallelParts: session.maxParallelParts }),
		fingerprintHex: session.fingerprintHex,
		parts: session.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64, targetOperation }) => ({
			partNumber,
			sizeBytes,
			sha256Hex,
			md5Base64,
			...(targetOperation ? {
				targetOperation: {
					attemptId: targetOperation.attemptId,
					requestId: targetOperation.requestId,
					expectedRevision: targetOperation.expectedRevision,
					...(targetOperation.operationId ? { operationId: targetOperation.operationId } : {}),
					...(targetOperation.generation === undefined ? {} : { generation: targetOperation.generation })
				}
			} : {})
		})),
		uploadMode: session.uploadMode,
		...(session.attemptId ? { attemptId: session.attemptId } : {}),
		attemptNumber: session.attemptNumber,
		revision: session.revision,
		...(session.expiresAtEpochMs === undefined
			? {}
			: { expiresAtEpochMs: session.expiresAtEpochMs }),
		...(session.fallbackUsed === undefined ? {} : { fallbackUsed: session.fallbackUsed }),
		...(session.failureCode === undefined ? {} : { failureCode: session.failureCode }),
		...(session.readyForParts === undefined ? {} : { readyForParts: session.readyForParts }),
		phase: session.phase
	};
}

export class IndexedDbMultipartSessionStore implements MultipartSessionStore {
	private databasePromise?: Promise<IDBDatabase>;
	private readonly databaseName: string;

	constructor(databaseName = 'unisource-cloud-multipart-v1') {
		this.databaseName = databaseName;
	}

	private database(): Promise<IDBDatabase> {
		if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Multipart session storage is only available in a browser.'));
		if (!this.databasePromise) this.databasePromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(this.databaseName, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains('sessions')) {
					request.result.createObjectStore('sessions', { keyPath: ['ownerId', 'localId'] });
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? new Error('Could not open multipart session store.'));
			request.onblocked = () => reject(new Error('Opening multipart session storage was blocked.'));
		});
		return this.databasePromise;
	}

	async put(session: PersistedMultipartSession): Promise<void> {
		const database = await this.database();
		const transaction = database.transaction('sessions', 'readwrite');
		const done = transactionDone(transaction);
		transaction.objectStore('sessions').put(copySafeFields(session));
		await done;
	}

	async get(ownerId: string, localId: string): Promise<PersistedMultipartSession | undefined> {
		const database = await this.database();
		const transaction = database.transaction('sessions', 'readonly');
		const done = transactionDone(transaction);
		const result = await resultOf(
			transaction.objectStore('sessions').get([ownerId, localId]) as IDBRequest<
				PersistedMultipartSession | undefined
			>
		);
		await done;
		return result;
	}

	async list(ownerId: string): Promise<PersistedMultipartSession[]> {
		const database = await this.database();
		const transaction = database.transaction('sessions', 'readonly');
		const done = transactionDone(transaction);
		const records: PersistedMultipartSession[] = [];
		const range = IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']);
		await new Promise<void>((resolve, reject) => {
			const request = transaction.objectStore('sessions').openCursor(range);
			request.onsuccess = () => {
				const cursor = request.result;
				if (!cursor) {
					resolve();
					return;
				}
				records.push(cursor.value as PersistedMultipartSession);
				cursor.continue();
			};
			request.onerror = () => reject(request.error ?? new Error('Could not list multipart sessions.'));
		});
		await done;
		return records;
	}

	async delete(ownerId: string, localId: string): Promise<void> {
		const database = await this.database();
		const transaction = database.transaction('sessions', 'readwrite');
		const done = transactionDone(transaction);
		transaction.objectStore('sessions').delete([ownerId, localId]);
		await done;
	}

	close(): void {
		void this.databasePromise?.then((database) => database.close());
	}
}
