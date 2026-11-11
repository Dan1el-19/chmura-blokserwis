import type { Client } from '@connectrpc/connect';
import { Code, ConnectError } from '@connectrpc/connect';
import {
	MultipartPartState,
	MultipartProtocol,
	MultipartUploadState,
	MultipartDigestOrigin,
	MultipartService,
	type MultipartPart,
	type MultipartUploadSession
} from '../gen/unisourcecfl/upload/v1/multipart_pb.js';
import { UploadErrorDetailSchema, UploadFailureKind, UploadMode } from '../gen/unisourcecfl/upload/v1/upload_pb.js';
import { UploadTargetError, UploadTransportError, uploadToTarget } from '../upload.js';
import { calculateMultipartManifest, type MultipartManifest } from './digest.js';
import { canCreateMultipartUpload, MULTIPART_PART_BYTES } from './protocol.js';
import type { MultipartCapabilities } from './protocol.js';
import type { MultipartSessionStore, PersistedMultipartSession } from './session-store.js';

export type MultipartRpc = Pick<
	Client<typeof MultipartService>,
	| 'beginMultipartUpload'
	| 'getMultipartUpload'
	| 'getMultipartPartTarget'
	| 'confirmMultipartPart'
	| 'completeMultipartUpload'
	| 'cancelMultipartUpload'
	| 'retryMultipartUpload'
>;

export type MultipartControllerOptions = {
	ownerId: string;
	capabilities?: MultipartCapabilities;
	rpc: MultipartRpc;
	store: MultipartSessionStore;
	hash?: (file: Blob, signal: AbortSignal) => Promise<MultipartManifest>;
	put?: (blob: Blob, url: string, headers: Record<string, string>, signal: AbortSignal, onProgress: (loaded: number, total: number) => void) => Promise<void>;
	onProgress?: (localId: string, partNumber: number, loaded: number, total: number) => void;
	isOnline?: () => boolean;
	id?: () => string;
	maxPartRetries?: number;
	readinessPollMs?: number;
};

export type MultipartProgressEvent = {
	localId: string;
	partNumber?: number;
	loaded?: number;
	total?: number;
	reset?: boolean;
};

export type MultipartDestination = { spaceId: string; parentId?: string; label?: string; name?: string; replaceEntryId?: string; replaceExpectedRevision?: number };

export class MultipartNameConflictError extends Error {
	constructor() { super('Nazwa jest już zajęta.'); this.name='MultipartNameConflictError'; }
}

export class MultipartUnavailableError extends Error {
	constructor() {
		super('Multipart uploads are not enabled for this file and server.');
		this.name = 'MultipartUnavailableError';
	}
}

export class MultipartFileMismatchError extends Error {
	constructor() {
		super('The selected file does not match the saved multipart upload.');
		this.name = 'MultipartFileMismatchError';
	}
}

export class MultipartOutcomeUnknownError extends Error {
	constructor(readonly partNumber: number) {
		super(`Part ${partNumber} has an unresolved producer; refresh the session before retrying.`);
		this.name = 'MultipartOutcomeUnknownError';
	}
}

export class MultipartOfflineError extends Error {
	constructor() {
		super('Multipart upload is paused while the browser is offline.');
		this.name = 'MultipartOfflineError';
	}
}

export class MultipartProviderUnavailableError extends Error {
	constructor() {
		super('The selected storage provider is unavailable.');
		this.name = 'MultipartProviderUnavailableError';
	}
}

export class MultipartAccountChangedError extends Error {
	constructor() {
		super('The signed-in account changed during this multipart upload.');
		this.name = 'MultipartAccountChangedError';
	}
}

class MultipartRevisionConflictExhaustedError extends Error {
	constructor(readonly conflict: ConnectError) {
		super('Multipart part targeting exceeded the revision conflict retry limit.', { cause: conflict });
		this.name = 'MultipartRevisionConflictExhaustedError';
	}
}

type ActiveUpload = { abort: AbortController; generation: number };

function defaultId(): string {
	return crypto.randomUUID();
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(signal.reason ?? new DOMException('Upload paused.', 'AbortError'));
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', abort);
			resolve();
		}, milliseconds);
		const abort = () => {
			clearTimeout(timer);
			signal.removeEventListener('abort', abort);
			reject(signal.reason ?? new DOMException('Upload paused.', 'AbortError'));
		};
		signal.addEventListener('abort', abort, { once: true });
	});
}

function isVerifiedPart(part: MultipartPart | undefined, expected: PersistedMultipartSession['parts'][number]): boolean {
	return !!part &&
		part.partNumber === expected.partNumber &&
		part.state === MultipartPartState.CONFIRMED &&
		(part.sha256Origin === MultipartDigestOrigin.GATEWAY_RECEIPT ||
			part.sha256Origin === MultipartDigestOrigin.SERVER_VERIFIED) &&
		part.sizeBytes === BigInt(expected.sizeBytes) &&
		part.sha256Hex === expected.sha256Hex;
}

function errorFailureKind(error: unknown, online: boolean): UploadFailureKind | undefined {
	if (!online) return UploadFailureKind.OFFLINE;
	if (error instanceof UploadTransportError) return UploadFailureKind.TRANSPORT;
	if (error instanceof UploadTargetError && error.status >= 500) return UploadFailureKind.SERVER;
	if (error instanceof ConnectError) {
		if (error.code === Code.Unauthenticated || error.code === Code.PermissionDenied ||
			error.code === Code.InvalidArgument || error.code === Code.FailedPrecondition ||
			error.code === Code.DataLoss || error.code === Code.Canceled) return undefined;
		if (error.code === Code.Unavailable || error.code === Code.DeadlineExceeded ||
			error.code === Code.ResourceExhausted || error.code === Code.Internal) return UploadFailureKind.SERVER;
	}
	return undefined;
}

function isTrustedRevisionConflict(error: unknown): error is ConnectError {
	return error instanceof ConnectError && error.code === Code.Aborted &&
		error.findDetails(UploadErrorDetailSchema).some((detail) => detail.code === 'REVISION_CONFLICT');
}

/** Browser-side multipart session coordinator. Durable records contain only hashes and protocol metadata. */
export class MultipartController {
	private ownerId: string;
	private ownerGeneration = 0;
	private readonly active = new Map<string, ActiveUpload>();
	private readonly progressListeners = new Set<(event: MultipartProgressEvent) => void>();
	private capabilities?: MultipartCapabilities;
	private readonly hash: NonNullable<MultipartControllerOptions['hash']>;
	private readonly put: NonNullable<MultipartControllerOptions['put']>;
	private readonly isOnline: NonNullable<MultipartControllerOptions['isOnline']>;
	private readonly makeId: NonNullable<MultipartControllerOptions['id']>;
	private readonly maxPartRetries: number;
	private readonly readinessPollMs: number;

	constructor(private readonly options: MultipartControllerOptions) {
		if (!options.ownerId) throw new Error('Multipart sessions must be scoped to a signed-in owner.');
		this.ownerId = options.ownerId;
		this.capabilities = options.capabilities;
		this.hash = options.hash ?? ((file, signal) => calculateMultipartManifest(file, { signal }));
		this.put = options.put ?? ((blob, url, headers, signal, onProgress) => uploadToTarget(blob, url, headers, { signal, onProgress }));
		this.isOnline = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
		this.makeId = options.id ?? defaultId;
		this.maxPartRetries = options.maxPartRetries ?? 3;
		this.readinessPollMs = options.readinessPollMs ?? 500;
	}

	setAccountId(ownerId: string): void {
		if (ownerId === this.ownerId) return;
		this.ownerId = ownerId;
		this.ownerGeneration++;
		for (const upload of this.active.values()) upload.abort.abort();
		this.active.clear();
	}

	setCapabilities(capabilities: MultipartCapabilities | undefined): void {
		this.capabilities = capabilities;
	}

	subscribeProgress(listener: (event: MultipartProgressEvent) => void): () => void {
		this.progressListeners.add(listener);
		return () => this.progressListeners.delete(listener);
	}

	listSessions(): Promise<PersistedMultipartSession[]> {
		return this.options.store.list(this.ownerId);
	}

	async start(file: File, destination: MultipartDestination, uploadMode = UploadMode.AUTO, localId = this.makeId()): Promise<PersistedMultipartSession> {
		const ownerId = this.ownerId;
		const generation = this.ownerGeneration;
		const existing = await this.options.store.get(ownerId, localId);
		if (ownerId !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
		if (existing) return this.resume(localId, file);
		if (!canCreateMultipartUpload(this.capabilities, file.size)) throw new MultipartUnavailableError();
		const abort = new AbortController();
		this.active.set(localId, { abort, generation });
		try {
			const manifest = await this.hash(file, abort.signal);
			this.assertCurrent(localId, generation, abort.signal);
			const session: PersistedMultipartSession = {
				ownerId: this.ownerId,
				localId,
				requestId: this.makeId(),
				spaceId: destination.spaceId,
				...(destination.label ? { targetLabel: destination.label } : {}),
				...(destination.parentId ? { parentId: destination.parentId } : {}),
				name: destination.name ?? file.name,
				...(destination.replaceEntryId !== undefined ? { replaceEntryId: destination.replaceEntryId, replaceExpectedRevision: destination.replaceExpectedRevision } : {}),
				sizeBytes: file.size,
				partSizeBytes: MULTIPART_PART_BYTES,
				fingerprintHex: manifest.fingerprintHex,
				parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64 })),
				uploadMode,
				attemptNumber: 0,
				revision: 0n,
				phase: 'beginning'
			};
			await this.options.store.put(session);
			return await this.beginAndTransfer(session, file, abort.signal, generation);
		} finally {
			if (this.active.get(localId)?.abort === abort) this.active.delete(localId);
		}
	}

	async resume(localId: string, file: File): Promise<PersistedMultipartSession> {
		const ownerId = this.ownerId;
		const generation = this.ownerGeneration;
		const session = await this.options.store.get(ownerId, localId);
		if (ownerId !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
		if (!session || session.ownerId !== ownerId) throw new Error('Saved multipart session was not found.');
		const abort = new AbortController();
		this.active.set(localId, { abort, generation });
		try {
			const manifest = await this.hash(file, abort.signal);
			this.assertCurrent(localId, generation, abort.signal);
			if (file.size !== session.sizeBytes || manifest.fingerprintHex !== session.fingerprintHex) throw new MultipartFileMismatchError();
			if (manifest.parts.length !== session.parts.length || manifest.parts.some((part, index) => {
				const saved = session.parts[index];
				return !saved || part.partNumber !== saved.partNumber || part.sizeBytes !== saved.sizeBytes ||
					part.sha256Hex !== saved.sha256Hex || part.md5Base64 !== saved.md5Base64;
			})) throw new MultipartFileMismatchError();
			// A lost Begin response leaves only its idempotency key on disk. Replaying that
			// request recovers the server session without requiring creation to be enabled now.
			if (!session.uploadId) return await this.beginAndTransfer(session, file, abort.signal, generation);
			return await this.transfer(session, file, abort.signal, generation);
		} finally {
			if (this.active.get(localId)?.abort === abort) this.active.delete(localId);
		}
	}

	async pause(localId: string): Promise<void> {
		const ownerId = this.ownerId;
		const active = this.active.get(localId);
		if (active) {
			active.abort.abort();
			this.active.delete(localId);
		}
		const session = await this.options.store.get(ownerId, localId);
		if (ownerId === this.ownerId && session && session.phase !== 'completed' && session.phase !== 'cancelled') {
			session.phase = 'paused';
			await this.options.store.put(session);
		}
	}

	async cancel(localId: string): Promise<void> {
		const ownerId = this.ownerId;
		const generation = this.ownerGeneration;
		const active = this.active.get(localId);
		active?.abort.abort();
		this.active.delete(localId);
		const session = await this.options.store.get(ownerId, localId);
		if (ownerId !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
		if (!session) return;
		if (!session.uploadId) {
			// Begin is idempotent by requestId. Recover a possibly-created server session
			// before cancelling, so a lost Begin response cannot orphan a reservation.
			try {
				await this.openSession(session);
			} catch (error) {
				if (ownerId !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
				// A failed replay does not prove that Begin was not committed. Keep the
				// idempotency key so a later recovery can discover and cancel that session.
				session.phase = 'paused';
				await this.options.store.put(session);
				throw error;
			}
		}
		if (ownerId !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
		const response = await this.options.rpc.cancelMultipartUpload({
			uploadId: session.uploadId,
			expectedRevision: session.revision,
			requestId: this.makeId()
		});
		if (ownerId !== this.ownerId) throw new MultipartAccountChangedError();
		if (response.session) this.applyRemoteSession(session, response.session);
		session.phase = 'cancelled';
		await this.options.store.put(session);
	}

	private assertCurrent(localId: string, generation: number, signal: AbortSignal): void {
		if (signal.aborted) throw signal.reason ?? new DOMException('Upload paused.', 'AbortError');
		if (generation !== this.ownerGeneration || !this.ownerId) throw new MultipartAccountChangedError();
		if (!this.isOnline()) throw new MultipartOfflineError();
		if (!this.active.has(localId)) throw new DOMException('Upload paused.', 'AbortError');
	}

	private async openSession(session: PersistedMultipartSession, signal?: AbortSignal, generation?: number): Promise<void> {
		if (signal && generation !== undefined) this.assertCurrent(session.localId, generation, signal);
		const response = await this.options.rpc.beginMultipartUpload({
			spaceId: session.spaceId,
			...(session.parentId ? { parentId: session.parentId } : {}),
			name: session.name,
			...(session.replaceEntryId !== undefined ? { replaceEntryId: session.replaceEntryId, replaceExpectedRevision: session.replaceExpectedRevision } : {}),
			sizeBytes: BigInt(session.sizeBytes),
			manifestFingerprintHex: session.fingerprintHex,
			manifestParts: session.parts.map((part) => ({ partNumber: part.partNumber, sizeBytes: BigInt(part.sizeBytes), sha256Hex: part.sha256Hex })),
			uploadMode: session.uploadMode,
			supportsNameConflict: true,
			requestId: session.requestId
		});
		if (signal && generation !== undefined) this.assertCurrent(session.localId, generation, signal);
		if (!response.session || response.partSizeBytes !== BigInt(session.partSizeBytes) || response.session.protocol !== MultipartProtocol.V1 || response.session.manifestFingerprintHex !== session.fingerprintHex || response.session.sizeBytes !== BigInt(session.sizeBytes)) throw new Error('Multipart server response did not match the requested manifest.');
		if (response.maxParallelParts < 1) throw new Error('Multipart server returned an invalid parallel part limit.');
		this.applyRemoteSession(session, response.session);
		session.maxParallelParts = Math.min(response.maxParallelParts, 2);
		await this.options.store.put(session);
	}

	private async beginAndTransfer(session: PersistedMultipartSession, file: File, signal: AbortSignal, generation: number): Promise<PersistedMultipartSession> {
		this.assertCurrent(session.localId, generation, signal);
		try {
			await this.openSession(session, signal, generation);
		} catch (error) {
			if (error instanceof ConnectError && error.code === Code.Aborted && error.findDetails(UploadErrorDetailSchema).some(detail => detail.code === 'NAME_CONFLICT')) {
				this.assertCurrent(session.localId, generation, signal);
				await this.options.store.delete(session.ownerId, session.localId);
				this.assertCurrent(session.localId, generation, signal);
				throw new MultipartNameConflictError();
			}
			throw error;
		}
		return this.transfer(session, file, signal, generation);
	}

	private applyRemoteSession(local: PersistedMultipartSession, remote: MultipartUploadSession): void {
		if (
			(remote.protocol !== MultipartProtocol.V1) ||
			(remote.spaceId !== local.spaceId) ||
			(remote.name !== local.name) ||
			(remote.sizeBytes !== BigInt(local.sizeBytes)) ||
			(remote.manifestFingerprintHex !== local.fingerprintHex) ||
			(local.uploadId !== undefined && remote.id !== local.uploadId)
		) throw new Error('Multipart server session did not match the saved upload.');
		local.uploadId = remote.id;
		const attemptChanged = local.attemptId !== undefined && local.attemptId !== remote.attemptId;
		if (remote.attemptNumber >= local.attemptNumber) {
			local.attemptId = remote.attemptId;
			local.attemptNumber = remote.attemptNumber;
		}
		if (attemptChanged) {
			for (const part of local.parts) delete part.targetOperation;
		}
		if (remote.revision > local.revision) local.revision = remote.revision;
		local.expiresAtEpochMs = remote.expiresAt ? Number(remote.expiresAt.seconds) * 1000 + Math.floor(remote.expiresAt.nanos / 1_000_000) : undefined;
		local.failureCode = remote.failureCode || undefined;
		local.readyForParts = remote.readyForParts;
		if (remote.state === MultipartUploadState.OPEN) local.phase = remote.readyForParts ? 'uploading' : 'beginning';
		else if (remote.state === MultipartUploadState.COMPLETED) local.phase = 'completed';
		else if (remote.state === MultipartUploadState.FINALIZING || remote.state === MultipartUploadState.VERIFYING) local.phase = 'verifying';
		else if (remote.state === MultipartUploadState.CANCELLED) local.phase = 'cancelled';
		else if (remote.state === MultipartUploadState.EXPIRED || remote.state === MultipartUploadState.FAILED) local.phase = 'failed';
	}

	private async waitForPartsReady(session: PersistedMultipartSession, signal: AbortSignal, generation: number): Promise<void> {
		while (true) {
			this.assertCurrent(session.localId, generation, signal);
			if (session.failureCode === 'STORAGE_UNAVAILABLE') throw new MultipartProviderUnavailableError();
			if (session.phase === 'completed' || session.phase === 'verifying' || session.phase === 'cancelled' || session.phase === 'failed') return;
			if (session.readyForParts) return;
			await abortableDelay(this.readinessPollMs, signal);
			this.assertCurrent(session.localId, generation, signal);
			const response = await this.options.rpc.getMultipartUpload({ uploadId: session.uploadId!, pageSize: 1, partNumberCursor: 0 });
			this.assertCurrent(session.localId, generation, signal);
			if (!response.session) throw new Error('Multipart session response is missing while waiting for provider initialization.');
			this.applyRemoteSession(session, response.session);
			await this.options.store.put(session);
		}
	}

	private async fetchParts(session: PersistedMultipartSession, signal: AbortSignal, generation: number): Promise<Map<number, MultipartPart>> {
		const found = new Map<number, MultipartPart>();
		let cursor = 0;
		while (true) {
			this.assertCurrent(session.localId, generation, signal);
			const response = await this.options.rpc.getMultipartUpload({ uploadId: session.uploadId!, pageSize: 100, partNumberCursor: cursor });
			this.assertCurrent(session.localId, generation, signal);
			if (!response.session) throw new Error('Multipart session response is missing.');
			this.applyRemoteSession(session, response.session);
			for (const part of response.parts) {
				found.set(part.partNumber, part);
				const expected = session.parts.find((candidate) => candidate.partNumber === part.partNumber);
				if (expected && (isVerifiedPart(part, expected) ||
					(part.state === MultipartPartState.MISSING && part.producerClosedAt !== undefined))) {
					delete expected.targetOperation;
				}
			}
			if (!response.hasMoreParts) break;
			if (response.nextPartNumberCursor <= cursor) throw new Error('Multipart part pagination did not advance.');
			cursor = response.nextPartNumberCursor;
		}
		await this.options.store.put(session);
		return found;
	}

	private async waitForPartResolution(
		session: PersistedMultipartSession,
		expected: PersistedMultipartSession['parts'][number],
		initial: MultipartPart,
		signal: AbortSignal,
		generation: number
	): Promise<MultipartPart> {
		let current = initial;
		const deadline = current.producerDeadlineAt
			? Number(current.producerDeadlineAt.seconds) * 1000 + Math.floor(current.producerDeadlineAt.nanos / 1_000_000)
			: undefined;
		while (current.state === MultipartPartState.RECEIVING) {
			if (deadline === undefined || Date.now() >= deadline) {
				throw new MultipartOutcomeUnknownError(expected.partNumber);
			}
			await abortableDelay(Math.min(this.readinessPollMs, Math.max(1, deadline - Date.now())), signal);
			const latest = await this.fetchParts(session, signal, generation);
			current = latest.get(expected.partNumber) ?? current;
			if (current.state === MultipartPartState.UNKNOWN) throw new MultipartOutcomeUnknownError(expected.partNumber);
			if (current.state === MultipartPartState.CONFIRMED && !isVerifiedPart(current, expected)) {
				throw new MultipartOutcomeUnknownError(expected.partNumber);
			}
		}
		if (isVerifiedPart(current, expected)) {
			delete expected.targetOperation;
			this.reportProgress(session.localId, expected.partNumber, expected.sizeBytes, expected.sizeBytes);
			await this.options.store.put(session);
			return current;
		}
		if (current.state !== MultipartPartState.MISSING) throw new MultipartOutcomeUnknownError(expected.partNumber);
		return current;
	}

	private async transfer(session: PersistedMultipartSession, file: File | undefined, signal: AbortSignal, generation: number): Promise<PersistedMultipartSession> {
		if (!session.uploadId) throw new Error('Multipart upload has not been created.');
		if (session.ownerId !== this.ownerId) throw new MultipartAccountChangedError();
		try {
			await this.waitForPartsReady(session, signal, generation);
		} catch (error) {
			if (error instanceof MultipartProviderUnavailableError) return this.retryAfterProviderFailure(session, file, signal, generation);
			throw error;
		}
		if (session.failureCode === 'STORAGE_UNAVAILABLE') throw new MultipartProviderUnavailableError();
		session.phase = 'uploading';
		await this.options.store.put(session);
		const initialParts = await this.fetchParts(session, signal, generation);
		for (const expected of session.parts) {
			let part = initialParts.get(expected.partNumber);
			if (part?.state === MultipartPartState.RECEIVING) {
				part = await this.waitForPartResolution(session, expected, part, signal, generation);
				initialParts.set(expected.partNumber, part);
			}
			if (isVerifiedPart(part, expected)) {
				this.reportProgress(session.localId, expected.partNumber, expected.sizeBytes, expected.sizeBytes);
			}
		}
		const remotePhase = session.phase as PersistedMultipartSession['phase'];
		if (remotePhase === 'completed' || remotePhase === 'verifying') {
			await this.options.store.put(session);
			return session;
		}
		if (remotePhase === 'cancelled' || remotePhase === 'failed') {
			await this.options.store.put(session);
			throw new Error(`Multipart session is ${session.phase}.`);
		}
		const pending = session.parts.filter((expected) => {
			const part = initialParts.get(expected.partNumber);
			if (isVerifiedPart(part, expected)) return false;
			if (part && part.state !== MultipartPartState.MISSING) throw new MultipartOutcomeUnknownError(expected.partNumber);
			if (part && part.producerClosedAt === undefined && (part.generation > 0n || part.operationId)) {
				const operation = expected.targetOperation;
				if (!operation || operation.attemptId !== session.attemptId ||
					(operation.operationId !== undefined && operation.operationId !== part.operationId)) {
					throw new MultipartOutcomeUnknownError(expected.partNumber);
				}
			}
			return true;
		});
		if (pending.length && !file) throw new MultipartFileMismatchError();

		// Target issuance mutates the session revision, so serialize only that short RPC;
		// the bounded data PUT and receipt lookup run concurrently after each target arrives.
		let targetTail = Promise.resolve();
		const issueTarget = async (expected: PersistedMultipartSession['parts'][number]) => {
			let revisionConflicts = 0;
			let release!: () => void;
			const previous = targetTail;
			targetTail = new Promise<void>((resolve) => { release = resolve; });
			await previous;
			try {
				while (true) {
					this.assertCurrent(session.localId, generation, signal);
					if (fatalError) throw fatalError;
					const latest = await this.fetchParts(session, signal, generation);
					if (fatalError) throw fatalError;
					const observed = latest.get(expected.partNumber);
					if (isVerifiedPart(observed, expected)) return { alreadyConfirmed: true as const };
					if (observed?.state === MultipartPartState.RECEIVING) {
						const resolved = await this.waitForPartResolution(session, expected, observed, signal, generation);
						if (isVerifiedPart(resolved, expected)) return { alreadyConfirmed: true as const };
						if (resolved.producerClosedAt === undefined) throw new MultipartOutcomeUnknownError(expected.partNumber);
						delete expected.targetOperation;
						await this.options.store.put(session);
						continue;
					}
					if (observed && observed.state !== MultipartPartState.MISSING) throw new MultipartOutcomeUnknownError(expected.partNumber);
					if (observed?.state === MultipartPartState.MISSING && observed.producerClosedAt !== undefined) {
						delete expected.targetOperation;
					}
					if (observed && observed.producerClosedAt === undefined && (observed.generation > 0n || observed.operationId)) {
						const saved = expected.targetOperation;
						if (!saved || saved.attemptId !== session.attemptId ||
							(saved.operationId !== undefined && saved.operationId !== observed.operationId)) {
							throw new MultipartOutcomeUnknownError(expected.partNumber);
						}
					}
					let operation = expected.targetOperation;
					if (!operation || operation.attemptId !== session.attemptId) {
						operation = {
							attemptId: session.attemptId ?? '',
							requestId: this.makeId(),
							expectedRevision: session.revision
						};
						expected.targetOperation = operation;
						await this.options.store.put(session);
					}
					let response: Awaited<ReturnType<MultipartRpc['getMultipartPartTarget']>>;
					try {
						response = await this.options.rpc.getMultipartPartTarget({
							uploadId: session.uploadId!, attemptId: session.attemptId ?? '',
							partNumber: expected.partNumber, sizeBytes: BigInt(expected.sizeBytes),
							sha256Hex: expected.sha256Hex, md5Base64: expected.md5Base64,
							expectedRevision: operation.expectedRevision, requestId: operation.requestId
						});
					} catch (error) {
						if (!isTrustedRevisionConflict(error)) throw error;
						if (++revisionConflicts > 3) throw new MultipartRevisionConflictExhaustedError(error);
						const refreshed = await this.fetchParts(session, signal, generation);
						const latestPart = refreshed.get(expected.partNumber);
						if (isVerifiedPart(latestPart, expected)) return { alreadyConfirmed: true as const };
						const neverLeased = latestPart?.state === MultipartPartState.MISSING &&
							latestPart.generation === 0n && !latestPart.operationId;
						const closedWithoutWrite = latestPart?.state === MultipartPartState.MISSING &&
							latestPart.producerClosedAt !== undefined;
						if (!neverLeased && !closedWithoutWrite) {
							throw new MultipartOutcomeUnknownError(expected.partNumber);
						}
						// The server's explicit CAS conflict proves the stale request did not
						// create this lease. A never-leased part or an explicit no-write closure
						// is safe to target at the refreshed revision with a fresh request ID.
						delete expected.targetOperation;
						await this.options.store.put(session);
						continue;
					}
					this.assertCurrent(session.localId, generation, signal);
					if (!response.session || !response.part) throw new Error('Multipart part target response is incomplete.');
					this.applyRemoteSession(session, response.session);
					const part = response.part;
					if (part.partNumber !== expected.partNumber || part.sizeBytes !== BigInt(expected.sizeBytes) || part.sha256Hex !== expected.sha256Hex || part.md5Base64 !== expected.md5Base64) throw new Error('Multipart target response did not match the requested part.');
					if (part.state === MultipartPartState.CONFIRMED && isVerifiedPart(part, expected)) return { alreadyConfirmed: true as const };
					if (!response.target) throw new Error('Multipart part target response is missing its data-plane target.');
					if (part.state === MultipartPartState.RECEIVING) {
						const resolved = await this.waitForPartResolution(session, expected, part, signal, generation);
						if (isVerifiedPart(resolved, expected)) return { alreadyConfirmed: true as const };
						if (resolved.producerClosedAt === undefined) throw new MultipartOutcomeUnknownError(expected.partNumber);
						delete expected.targetOperation;
						await this.options.store.put(session);
						continue;
					}
					if (part.state === MultipartPartState.MISSING && part.producerClosedAt !== undefined) {
						delete expected.targetOperation;
						await this.options.store.put(session);
						continue;
					}
					if (part.state !== MultipartPartState.MISSING || part.generation < 1n || !part.operationId ||
						part.operationId !== operation.requestId ||
						(operation.operationId !== undefined && operation.operationId !== part.operationId)) {
						throw new MultipartOutcomeUnknownError(expected.partNumber);
					}
					operation.operationId = part.operationId;
					operation.generation = part.generation;
					await this.options.store.put(session);
					return { alreadyConfirmed: false as const, target: response.target, operationId: part.operationId };
				}
			} finally {
				release();
			}
		};

		let nextIndex = 0;
		let fatalError: unknown;
		let providerFailure: UploadTargetError | undefined;
		const providerFailureParts = new Set<number>();
		const worker = async () => {
			while (!fatalError) {
				const expected = pending[nextIndex++];
				if (!expected) return;
				let completed = false;
				let lastError: unknown;
				for (let retry = 0; retry < this.maxPartRetries && !completed; retry++) {
					this.assertCurrent(session.localId, generation, signal);
					try {
						const issued = await issueTarget(expected);
						if (issued.alreadyConfirmed) { completed = true; break; }
						const start = (expected.partNumber - 1) * session.partSizeBytes;
						const blob = file!.slice(start, start + expected.sizeBytes);
						if (blob.size !== expected.sizeBytes) throw new MultipartFileMismatchError();
						await this.put(blob, issued.target.url, issued.target.headers, signal, (loaded, total) => {
							this.reportProgress(session.localId, expected.partNumber, loaded, total);
						});
						this.assertCurrent(session.localId, generation, signal);
						const confirm = await this.options.rpc.confirmMultipartPart({
							uploadId: session.uploadId!, attemptId: session.attemptId ?? '',
							partNumber: expected.partNumber, operationId: issued.operationId,
							expectedRevision: session.revision, requestId: this.makeId()
						});
						this.assertCurrent(session.localId, generation, signal);
						if (!confirm.session || !isVerifiedPart(confirm.part, expected)) throw new Error('Multipart part confirmation did not include a verified receipt.');
						this.applyRemoteSession(session, confirm.session);
						delete expected.targetOperation;
						this.reportProgress(session.localId, expected.partNumber, expected.sizeBytes, expected.sizeBytes);
						await this.options.store.put(session);
						completed = true;
					} catch (error) {
						if (signal.aborted || error instanceof MultipartAccountChangedError || error instanceof MultipartOfflineError || error instanceof MultipartRevisionConflictExhaustedError) throw error;
						if (error instanceof UploadTargetError && error.status >= 500 && error.code === 'STORAGE_UNAVAILABLE') {
							// The receiver response alone is not sufficient to authorize a provider
							// switch. Require the authenticated control session's durable classification.
							const status = await this.options.rpc.getMultipartUpload({ uploadId: session.uploadId!, pageSize: 1, partNumberCursor: 0 });
							if (status.session) this.applyRemoteSession(session, status.session);
							if (session.failureCode === 'STORAGE_UNAVAILABLE') {
								providerFailure ??= error;
								providerFailureParts.add(expected.partNumber);
							} else {
								lastError = error;
								break;
							}
						}
						lastError = error;
						const kind = errorFailureKind(error, this.isOnline());
						if (!kind || retry + 1 >= this.maxPartRetries) break;
					}
				}
				if (!completed) throw lastError ?? new Error('Multipart part failed.');
			}
		};
		const parallel = Math.min(2, Math.max(1, session.maxParallelParts ?? 2));
		const workers = Array.from({ length: Math.min(parallel, pending.length) }, async () => {
			try { await worker(); } catch (error) { fatalError ??= error; }
		});
		await Promise.all(workers);
		if (fatalError) {
			const fatalIsProviderFailure = fatalError instanceof MultipartProviderUnavailableError ||
				(fatalError instanceof UploadTargetError && fatalError.status >= 500 && fatalError.code === 'STORAGE_UNAVAILABLE' && session.failureCode === 'STORAGE_UNAVAILABLE');
			const fatalIsProviderUnknown = fatalError instanceof MultipartOutcomeUnknownError && providerFailureParts.has(fatalError.partNumber);
			const kind = fatalError instanceof MultipartProviderUnavailableError ? UploadFailureKind.SERVER :
				providerFailure && (fatalIsProviderFailure || fatalIsProviderUnknown) ? errorFailureKind(providerFailure, this.isOnline()) : undefined;
			// Both providers share one Node receiver; generic gateway and network errors
			// cannot prove that switching storage will help. A classified provider failure
			// may leave the old attempt UNKNOWN; Retry fences it and retains cleanup debt.
			const storageFailure = session.failureCode === 'STORAGE_UNAVAILABLE' &&
				(fatalError instanceof MultipartProviderUnavailableError || providerFailure !== undefined && (fatalIsProviderFailure || fatalIsProviderUnknown));
			if (session.uploadMode === UploadMode.AUTO && !session.fallbackUsed && session.attemptNumber <= 1 && storageFailure && kind !== undefined && (kind === UploadFailureKind.TRANSPORT || kind === UploadFailureKind.SERVER))
				return this.retryAfterProviderFailure(session, file, signal, generation);
			throw fatalError;
		}
		await this.options.store.put(session);
		this.assertCurrent(session.localId, generation, signal);
		const completed = await this.options.rpc.completeMultipartUpload({ uploadId: session.uploadId, attemptId: session.attemptId ?? '', expectedRevision: session.revision, requestId: this.makeId() });
		this.assertCurrent(session.localId, generation, signal);
		if (!completed.session) throw new Error('Multipart completion response is missing.');
		this.applyRemoteSession(session, completed.session);
		session.phase = completed.session.state === MultipartUploadState.COMPLETED ? 'completed' : 'verifying';
		await this.options.store.put(session);
		return session;
	}

	private async retryAfterProviderFailure(session: PersistedMultipartSession, file: File | undefined, signal: AbortSignal, generation: number): Promise<PersistedMultipartSession> {
		if (session.uploadMode !== UploadMode.AUTO || session.fallbackUsed || session.attemptNumber > 1 || session.failureCode !== 'STORAGE_UNAVAILABLE') {
			throw new MultipartProviderUnavailableError();
		}
		this.assertCurrent(session.localId, generation, signal);
		const retried = await this.options.rpc.retryMultipartUpload({
			uploadId: session.uploadId!,
			failedAttemptId: session.attemptId ?? '',
			failureKind: UploadFailureKind.SERVER,
			expectedRevision: session.revision,
			requestId: this.makeId()
		});
		this.assertCurrent(session.localId, generation, signal);
		if (!retried.session) throw new MultipartProviderUnavailableError();
		this.applyRemoteSession(session, retried.session);
		session.fallbackUsed = true;
		session.failureCode = undefined;
		session.readyForParts = retried.session.readyForParts;
		this.reportProgress(session.localId, undefined, undefined, undefined, true);
		await this.options.store.put(session);
		return this.transfer(session, file, signal, generation);
	}

	async refreshSession(localId: string): Promise<PersistedMultipartSession> {
		const ownerId = this.ownerId;
		const session = await this.options.store.get(ownerId, localId);
		if (ownerId !== this.ownerId) throw new MultipartAccountChangedError();
		if (!session) throw new Error('Saved multipart session was not found.');
		if (!session.uploadId) return session;
		const response = await this.options.rpc.getMultipartUpload({ uploadId: session.uploadId, pageSize: 1, partNumberCursor: 0 });
		if (ownerId !== this.ownerId) throw new MultipartAccountChangedError();
		if (!response.session) throw new Error('Multipart session response is missing.');
		this.applyRemoteSession(session, response.session);
		await this.options.store.put(session);
		return session;
	}

	async forgetNameConflict(localId: string): Promise<void> {
		const owner = this.ownerId, generation = this.ownerGeneration;
		const session = await this.refreshSession(localId);
		if (owner !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
		if (!session.uploadId || session.phase !== 'failed' || session.failureCode !== 'NAME_CONFLICT') throw new Error('Nie potwierdzono zakończonej sesji z konfliktem nazwy.');
		await this.options.store.delete(owner, localId);
		if (owner !== this.ownerId || generation !== this.ownerGeneration) throw new MultipartAccountChangedError();
	}

	private reportProgress(localId: string, partNumber?: number, loaded?: number, total?: number, reset = false): void {
		if (partNumber !== undefined && loaded !== undefined && total !== undefined) {
			this.options.onProgress?.(localId, partNumber, loaded, total);
		}
		const event: MultipartProgressEvent = { localId, ...(partNumber === undefined ? {} : { partNumber }), ...(loaded === undefined ? {} : { loaded }), ...(total === undefined ? {} : { total }), ...(reset ? { reset: true } : {}) };
		for (const listener of this.progressListeners) listener(event);
	}
}
