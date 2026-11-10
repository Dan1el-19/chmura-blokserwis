import { expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
	MultipartDigestOrigin,
	MultipartPartState,
	MultipartProtocol,
	MultipartUploadState,
	type GetMultipartUploadRequest,
	type MultipartPart
} from '../gen/unisourcecfl/upload/v1/multipart_pb.js';
import { UploadErrorDetailSchema, UploadMode } from '../gen/unisourcecfl/upload/v1/upload_pb.js';
import { UploadTargetError, UploadTransportError } from '../upload.js';
import { MultipartController, MultipartNameConflictError, MultipartFileMismatchError, MultipartOfflineError, MultipartUnavailableError, type MultipartRpc } from './controller.js';
import { MULTIPART_PART_BYTES } from './protocol.js';
import type { MultipartSessionStore, PersistedMultipartSession } from './session-store.js';

const partSizes = [MULTIPART_PART_BYTES, MULTIPART_PART_BYTES, MULTIPART_PART_BYTES, 1_000_001];
const fileSize = partSizes.reduce((sum, size) => sum + size, 0);
const manifest = {
	sizeBytes: fileSize,
	partSizeBytes: MULTIPART_PART_BYTES,
	fingerprintHex: 'f'.repeat(64),
	parts: partSizes.map((sizeBytes, index) => ({
		partNumber: index + 1,
		sizeBytes,
		sha256Hex: String(index + 1).repeat(64),
		md5Base64: `md5-${index + 1}`
	}))
};

class MemoryStore implements MultipartSessionStore {
	readonly records = new Map<string, PersistedMultipartSession>();
	async put(value: PersistedMultipartSession) { this.records.set(`${value.ownerId}:${value.localId}`, structuredClone(value)); }
	async get(ownerId: string, localId: string) { return this.records.get(`${ownerId}:${localId}`); }
	async list(ownerId: string) { return [...this.records.values()].filter((item) => item.ownerId === ownerId); }
	async delete(ownerId: string, localId: string) { this.records.delete(`${ownerId}:${localId}`); }
}

function fakeFile(name = 'large.bin', size = fileSize): File {
	return {
		name,
		size,
		lastModified: 1,
		slice: (start: number, end: number) => new Blob([new Uint8Array(end - start)])
	} as File;
}

function remoteSession(local: PersistedMultipartSession, overrides: Record<string, unknown> = {}) {
	return {
		id: 'upload-1',
		spaceId: local.spaceId,
		name: local.name,
		sizeBytes: BigInt(local.sizeBytes),
		protocol: MultipartProtocol.V1,
		manifestFingerprintHex: local.fingerprintHex,
		state: MultipartUploadState.OPEN,
		revision: 1n,
		attemptId: 'attempt-1',
		attemptNumber: 1,
		storageLocation: 0,
		cleanupPending: false,
		failureCode: '',
		readyForParts: true,
		...overrides
	} as never;
}

function currentRemoteSession(overrides: Record<string, unknown> = {}) {
	return remoteSession({ spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize, fingerprintHex: manifest.fingerprintHex } as PersistedMultipartSession, overrides);
}

function verifiedPart(partNumber: number): MultipartPart {
	const expected = manifest.parts[partNumber - 1]!;
	return {
		partNumber,
		state: MultipartPartState.CONFIRMED,
		sizeBytes: BigInt(expected.sizeBytes),
		sha256Hex: expected.sha256Hex,
		sha256Origin: MultipartDigestOrigin.GATEWAY_RECEIPT,
		md5Base64: expected.md5Base64,
		etag: `etag-${partNumber}`,
		generation: 1n,
		operationId: `op-${partNumber}`
	} as MultipartPart;
}

function missingPart(partNumber: number): MultipartPart {
	const expected = manifest.parts[partNumber - 1]!;
	return {
		partNumber,
		state: MultipartPartState.MISSING,
		sizeBytes: BigInt(expected.sizeBytes),
		sha256Hex: '',
		sha256Origin: MultipartDigestOrigin.UNSPECIFIED,
		md5Base64: '',
		etag: '',
		generation: 0n,
		operationId: ''
	} as MultipartPart;
}

function unknownPart(partNumber: number): MultipartPart {
	return { ...missingPart(partNumber), state: MultipartPartState.UNKNOWN, operationId: `unknown-${partNumber}` };
}

function createRpc() {
	let confirmed = new Set<number>();
	const unknown = new Set<number>();
	const activeProducers = new Map<number, { operationId: string; pollsRemaining: number }>();
	let revision = 1n;
	let attempt = 1;
	let failureCode = '';
	const targetOperations = new Map<string, { requestId: string; expectedRevision: bigint; operationId: string; generation: bigint; closed?: boolean }>();
	const targetKey = (partNumber: number) => `${attempt}:${partNumber}`;
	const rpc = {
		beginMultipartUpload: vi.fn(async (request) => ({
			session: remoteSession({ spaceId: request.spaceId, name: request.name, sizeBytes: Number(request.sizeBytes), fingerprintHex: request.manifestFingerprintHex } as PersistedMultipartSession),
			partSizeBytes: BigInt(MULTIPART_PART_BYTES),
			maxParallelParts: 2
		})),
		getMultipartUpload: vi.fn(async (_request: GetMultipartUploadRequest) => {
			void _request;
			return ({
			session: { id: 'upload-1', spaceId: 'space-1', name: 'large.bin', sizeBytes: BigInt(fileSize), protocol: MultipartProtocol.V1, manifestFingerprintHex: manifest.fingerprintHex, state: MultipartUploadState.OPEN, revision, attemptId: `attempt-${attempt}`, attemptNumber: attempt, storageLocation: 0, cleanupPending: false, failureCode, readyForParts: true } as never,
			parts: manifest.parts.map((part) => {
				if (attempt === 1 && unknown.has(part.partNumber)) return unknownPart(part.partNumber);
				if (confirmed.has(part.partNumber)) return verifiedPart(part.partNumber);
				const producer = activeProducers.get(part.partNumber);
				if (producer?.pollsRemaining) {
					producer.pollsRemaining--;
					return {
						...missingPart(part.partNumber), state: MultipartPartState.RECEIVING,
						generation: 1n, operationId: producer.operationId,
						producerDeadlineAt: { seconds: BigInt(Math.ceil((Date.now() + 5_000) / 1_000)), nanos: 0 }
					};
				}
				if (producer) {
					activeProducers.delete(part.partNumber);
					confirmed.add(part.partNumber);
					return verifiedPart(part.partNumber);
				}
				const operation = targetOperations.get(targetKey(part.partNumber));
				return operation ? {
					...missingPart(part.partNumber), generation: operation.generation, operationId: operation.operationId,
					...(operation.closed ? { producerClosedAt: { seconds: BigInt(Math.floor(Date.now() / 1_000)), nanos: 0 } } : {})
				} : missingPart(part.partNumber);
			}),
			nextPartNumberCursor: 0,
			hasMoreParts: false,
			verificationState: 0
		});
		}),
		getMultipartPartTarget: vi.fn(async (request) => {
			const key = targetKey(request.partNumber);
			let operation = targetOperations.get(key);
			if (operation?.closed) operation = undefined;
			if (operation) {
				if (request.requestId !== operation.requestId || request.expectedRevision !== operation.expectedRevision) {
					throw new Error('Target replay must preserve the original request ID and expected revision.');
				}
			} else {
				const priorGeneration = targetOperations.get(key)?.generation ?? 0n;
				operation = { requestId: request.requestId, expectedRevision: request.expectedRevision, operationId: request.requestId, generation: priorGeneration + 1n };
				targetOperations.set(key, operation);
				revision++;
			}
			return {
				session: currentRemoteSession({ revision, attemptId: `attempt-${attempt}`, attemptNumber: attempt }) as never,
				part: { ...missingPart(request.partNumber), sha256Hex: manifest.parts[request.partNumber - 1]!.sha256Hex, md5Base64: manifest.parts[request.partNumber - 1]!.md5Base64, generation: operation.generation, operationId: operation.operationId },
				target: { url: `https://storage.example/attempt-${attempt}/part-${request.partNumber}/signed`, headers: { 'Content-MD5': request.md5Base64 } }
			};
		}),
		confirmMultipartPart: vi.fn(async (request) => {
			confirmed.add(request.partNumber);
			return {
				session: currentRemoteSession({ revision, attemptId: `attempt-${attempt}`, attemptNumber: attempt }) as never,
				part: verifiedPart(request.partNumber)
			};
		}),
		completeMultipartUpload: vi.fn(async () => ({ session: currentRemoteSession({ revision: ++revision, attemptId: `attempt-${attempt}`, attemptNumber: attempt, state: MultipartUploadState.COMPLETED }) as never, entry: undefined })),
		cancelMultipartUpload: vi.fn(),
		retryMultipartUpload: vi.fn(async () => {
			// The prior provider attempt may retain UNKNOWN parts until cleanup proof.
			expect(unknown.size).toBeGreaterThan(0);
			confirmed = new Set();
			attempt++;
			failureCode = '';
			return { session: currentRemoteSession({ revision: ++revision, attemptId: `attempt-${attempt}`, attemptNumber: attempt }) as never, partSizeBytes: BigInt(MULTIPART_PART_BYTES), maxParallelParts: 2 };
		})
	};
	return { rpc: rpc as unknown as MultipartRpc, methods: rpc, state: {
		confirmed: () => confirmed,
		unknown: () => unknown,
		setFailureCode: (value: string) => { failureCode = value; },
		setRevision: (value: bigint) => { revision = value; },
		leasePart: (partNumber: number, requestId: string, expectedRevision: bigint, operationId: string) => {
			targetOperations.set(`${attempt}:${partNumber}`, { requestId, expectedRevision, operationId, generation: 1n });
		},
		closePartNoWrite: (partNumber: number) => {
			const operation = targetOperations.get(`${attempt}:${partNumber}`);
			if (operation) operation.closed = true;
		},
		activePart: (partNumber: number, operationId: string, pollsRemaining: number) => {
			activeProducers.set(partNumber, { operationId, pollsRemaining });
		}
	} };
}

const enabled = { enabled: true, maxFileBytes: 10_000_000_000n, partSizeBytes: BigInt(MULTIPART_PART_BYTES), maxParallelParts: 2, protocol: 'MULTIPART_V1' };

function controller(store: MemoryStore, rpc: MultipartRpc, extra: Partial<ConstructorParameters<typeof MultipartController>[0]> = {}) {
	return new MultipartController({
		ownerId: 'user-1',
		capabilities: enabled,
		rpc,
		store,
		hash: async () => manifest,
		put: async () => {},
		id: (() => { let id = 0; return () => `id-${++id}`; })(),
		...extra
	});
}

it('keeps multipart creation disabled unless the server explicitly advertises it', async () => {
	const { rpc } = createRpc();
	const subject = controller(new MemoryStore(), rpc, { capabilities: undefined });
	await expect(subject.start(fakeFile(), { spaceId: 'space-1' })).rejects.toBeInstanceOf(MultipartUnavailableError);
	expect(rpc.beginMultipartUpload).not.toHaveBeenCalled();
});

it('rehashes the selected file on resume and rejects same-name/same-size content changes before RPC', async () => {
	const store = new MemoryStore();
	const { rpc, methods } = createRpc();
	const subject = controller(store, rpc);
	const session = await subject.start(fakeFile(), { spaceId: 'space-1' });
	await subject.pause(session.localId);
	const changed = { ...manifest, fingerprintHex: '0'.repeat(64) };
	const resumed = controller(store, rpc, { hash: async () => changed });
	const calls = methods.getMultipartUpload.mock.calls.length;
	await expect(resumed.resume(session.localId, fakeFile())).rejects.toBeInstanceOf(MultipartFileMismatchError);
	expect(methods.getMultipartUpload).toHaveBeenCalledTimes(calls);
});

it('resumes only missing parts and completes after gateway receipt confirmation', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.confirmed().add(1);
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'saved-1', requestId: 'request-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64 })),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 1n, phase: 'paused'
	};
	await store.put(local);
	const subject = controller(store, rpc);
	const session = await subject.resume(local.localId, fakeFile());
	expect(session.phase).toBe('completed');
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
	expect(methods.getMultipartPartTarget.mock.calls.map(([request]) => request.partNumber)).toEqual([2, 3, 4]);
	expect(methods.getMultipartPartTarget.mock.calls.map(([request]) => request.expectedRevision)).toEqual([1n, 2n, 3n]);
	expect(rpc.completeMultipartUpload).toHaveBeenCalledTimes(1);
	const stored = await store.get('user-1', local.localId);
	expect(stored).toMatchObject({ phase: 'completed', uploadId: 'upload-1', fingerprintHex: manifest.fingerprintHex });
	expect(stored).not.toHaveProperty('file');
	expect(stored).not.toHaveProperty('token');
});

it('paginates confirmed receipts with bounded backend page sizes', async () => {
	const pageSize = 100;
	const parts = Array.from({ length: 250 }, (_, index) => ({
		partNumber: index + 1,
		sizeBytes: MULTIPART_PART_BYTES,
		sha256Hex: (index + 1).toString(16).padStart(64, '0'),
		md5Base64: `md5-${index + 1}`
	}));
	const largeManifest = {
		sizeBytes: parts.reduce((sum, part) => sum + part.sizeBytes, 0),
		partSizeBytes: MULTIPART_PART_BYTES,
		fingerprintHex: 'a'.repeat(64),
		parts
	};
	const store = new MemoryStore();
	const { rpc, methods } = createRpc();
	methods.getMultipartUpload.mockImplementation(async (request) => {
		const start = request.partNumberCursor;
		const slice = parts.slice(start, start + request.pageSize);
		return {
			session: remoteSession({ spaceId: 'space-1', name: 'paged.bin', sizeBytes: largeManifest.sizeBytes, fingerprintHex: largeManifest.fingerprintHex } as PersistedMultipartSession),
			parts: slice.map((part) => ({
				partNumber: part.partNumber,
				state: MultipartPartState.CONFIRMED,
				sizeBytes: BigInt(part.sizeBytes),
				sha256Hex: part.sha256Hex,
				sha256Origin: MultipartDigestOrigin.GATEWAY_RECEIPT,
				md5Base64: part.md5Base64,
				etag: `etag-${part.partNumber}`,
				generation: 1n,
				operationId: `op-${part.partNumber}`
			} as MultipartPart)),
			nextPartNumberCursor: start + slice.length,
			hasMoreParts: start + slice.length < parts.length,
			verificationState: 0
		};
	});
	methods.completeMultipartUpload.mockResolvedValue({
		session: remoteSession({ spaceId: 'space-1', name: 'paged.bin', sizeBytes: largeManifest.sizeBytes, fingerprintHex: largeManifest.fingerprintHex } as PersistedMultipartSession, { state: MultipartUploadState.COMPLETED }),
		entry: undefined
	} as never);
	await store.put({
		ownerId: 'user-1', localId: 'paged-1', requestId: 'request-paged', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'paged.bin', sizeBytes: largeManifest.sizeBytes,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: largeManifest.fingerprintHex,
		parts: parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64 })),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 1n, phase: 'paused'
	});
	const subject = controller(store, rpc, { hash: async () => largeManifest });
	const result = await subject.resume('paged-1', fakeFile('paged.bin', largeManifest.sizeBytes));

	expect(result.phase).toBe('completed');
	expect(methods.getMultipartUpload.mock.calls.map(([request]) => request.pageSize)).toEqual([1, pageSize, pageSize, pageSize]);
	expect(methods.getMultipartUpload.mock.calls.map(([request]) => request.partNumberCursor)).toEqual([0, 0, 100, 200]);
	expect(methods.getMultipartPartTarget).not.toHaveBeenCalled();
	expect(methods.completeMultipartUpload).toHaveBeenCalledTimes(1);
});

it('refreshes a missing part and uses a new target ID after a trusted revision conflict', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	const getTarget = methods.getMultipartPartTarget.getMockImplementation()!;
	let injectedConflict = false;
	methods.getMultipartPartTarget.mockImplementation(async (request) => {
		if (request.partNumber === 2 && !injectedConflict) {
			injectedConflict = true;
			// Model part 1's independent receipt advancing the session revision
			// after part 2's client read but before the compare-and-swap target RPC.
			state.confirmed().add(1);
			state.setRevision(request.expectedRevision + 1n);
			throw new ConnectError('REVISION_CONFLICT', Code.Aborted, undefined, [{
				desc: UploadErrorDetailSchema,
				value: create(UploadErrorDetailSchema, { code: 'REVISION_CONFLICT', requestId: request.requestId })
			}]);
		}
		return getTarget(request);
	});
	const subject = controller(store, rpc);

	const result = await subject.start(fakeFile(), { spaceId: 'space-1' });
	const partTwoTargets = methods.getMultipartPartTarget.mock.calls
		.map(([request]) => request)
		.filter((request) => request.partNumber === 2);

	expect(result.phase).toBe('completed');
	expect(partTwoTargets).toHaveLength(2);
	expect(partTwoTargets[1]!.requestId).not.toBe(partTwoTargets[0]!.requestId);
	expect(partTwoTargets[1]!.expectedRevision).toBeGreaterThan(partTwoTargets[0]!.expectedRevision);
	expect(methods.getMultipartPartTarget.mock.calls.map(([request]) => request.partNumber)).toEqual([1, 2, 2, 3, 4]);
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
});

it('replaces a conflicted target ID when the refreshed slot has explicit no-write closure proof', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.leasePart(2, 'old-closed-request', 1n, 'old-closed-request');
	state.closePartNoWrite(2);
	const getTarget = methods.getMultipartPartTarget.getMockImplementation()!;
	let injectedConflict = false;
	methods.getMultipartPartTarget.mockImplementation(async (request) => {
		if (request.partNumber === 2 && !injectedConflict) {
			injectedConflict = true;
			state.confirmed().add(1);
			state.setRevision(request.expectedRevision + 1n);
			throw new ConnectError('REVISION_CONFLICT', Code.Aborted, undefined, [{
				desc: UploadErrorDetailSchema,
				value: create(UploadErrorDetailSchema, { code: 'REVISION_CONFLICT', requestId: request.requestId })
			}]);
		}
		return getTarget(request);
	});
	const subject = controller(store, rpc);

	const result = await subject.start(fakeFile(), { spaceId: 'space-1' });
	const partTwoTargets = methods.getMultipartPartTarget.mock.calls
		.map(([request]) => request)
		.filter((request) => request.partNumber === 2);

	expect(result.phase).toBe('completed');
	expect(partTwoTargets).toHaveLength(2);
	expect(partTwoTargets[0]!.requestId).not.toBe('old-closed-request');
	expect(partTwoTargets[1]!.requestId).not.toBe(partTwoTargets[0]!.requestId);
	expect(partTwoTargets[1]!.expectedRevision).toBeGreaterThan(partTwoTargets[0]!.expectedRevision);
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
});

it('stops after three trusted target conflict retries', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	methods.getMultipartPartTarget.mockImplementation(async (request) => {
		state.setRevision(request.expectedRevision + 1n);
		throw new ConnectError('REVISION_CONFLICT', Code.Aborted, undefined, [{
			desc: UploadErrorDetailSchema,
			value: create(UploadErrorDetailSchema, { code: 'REVISION_CONFLICT', requestId: request.requestId })
		}]);
	});
	const subject = controller(store, rpc);

	await expect(subject.start(fakeFile(), { spaceId: 'space-1' })).rejects.toMatchObject({ name: 'MultipartRevisionConflictExhaustedError' });
	expect(methods.getMultipartPartTarget).toHaveBeenCalledTimes(4);
});

it('retains the Begin idempotency record when cancel replay times out ambiguously', async () => {
	const store = new MemoryStore();
	const { rpc, methods } = createRpc();
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'begin-timeout-1', requestId: 'begin-request-stable',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize, replaceEntryId: 'original-entry', replaceExpectedRevision: 7,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64 })),
		uploadMode: UploadMode.R2, attemptNumber: 0, revision: 0n, phase: 'beginning'
	};
	await store.put(local);
	methods.beginMultipartUpload.mockRejectedValueOnce(new ConnectError('request deadline exceeded', Code.DeadlineExceeded));
	const subject = controller(store, rpc);

	await expect(subject.cancel(local.localId)).rejects.toMatchObject({ code: Code.DeadlineExceeded });
	expect(methods.beginMultipartUpload).toHaveBeenCalledWith(expect.objectContaining({ requestId: local.requestId, replaceEntryId: 'original-entry', replaceExpectedRevision: 7 }));
	expect(methods.cancelMultipartUpload).not.toHaveBeenCalled();
	expect(await store.get('user-1', local.localId)).toMatchObject({ requestId: local.requestId, phase: 'paused' });
});

it('replays the same persisted target identity after an ambiguous target timeout', async () => {
	const store = new MemoryStore();
	const { rpc, methods } = createRpc();
	const getTarget = methods.getMultipartPartTarget.getMockImplementation()!;
	let lostResponse = false;
	methods.getMultipartPartTarget.mockImplementation(async (request) => {
		const response = await getTarget(request);
		if (!lostResponse && request.partNumber === 1) {
			lostResponse = true;
			throw new ConnectError('request deadline exceeded', Code.DeadlineExceeded);
		}
		return response;
	});
	const subject = controller(store, rpc);

	const result = await subject.start(fakeFile(), { spaceId: 'space-1' });
	const partOneTargets = methods.getMultipartPartTarget.mock.calls
		.map(([request]) => request)
		.filter((request) => request.partNumber === 1);

	expect(result.phase).toBe('completed');
	expect(partOneTargets).toHaveLength(2);
	expect(partOneTargets[1]!.requestId).toBe(partOneTargets[0]!.requestId);
	expect(partOneTargets[1]!.expectedRevision).toBe(partOneTargets[0]!.expectedRevision);
});

it('replays a persisted leased-part request after restart and preserves its bound operation metadata', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.leasePart(2, 'target-request-part-2', 1n, 'target-request-part-2');
	state.setRevision(2n);
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'restart-leased-1', requestId: 'request-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({
			partNumber, sizeBytes, sha256Hex, md5Base64,
			...(partNumber === 2 ? { targetOperation: { attemptId: 'attempt-1', requestId: 'target-request-part-2', expectedRevision: 1n, operationId: 'target-request-part-2', generation: 1n } } : {})
		})),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 2n, phase: 'paused'
	};
	await store.put(local);
	let persistedBeforePut: PersistedMultipartSession['parts'][number]['targetOperation'];
	const restarted = controller(store, rpc, {
		put: async (_blob, url) => {
			if (url.includes('/part-2/')) persistedBeforePut = (await store.get('user-1', local.localId))?.parts[1]?.targetOperation;
		}
	});
	const result = await restarted.resume(local.localId, fakeFile());

	expect(result.phase).toBe('completed');
	const replay = methods.getMultipartPartTarget.mock.calls.find(([request]) => request.partNumber === 2)?.[0];
	expect(replay).toMatchObject({ requestId: 'target-request-part-2', expectedRevision: 1n });
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
	expect(persistedBeforePut).toMatchObject({
		attemptId: 'attempt-1', requestId: 'target-request-part-2', expectedRevision: 1n,
		operationId: 'target-request-part-2', generation: 1n
	});
	const stored = await store.get('user-1', local.localId);
	expect(stored?.parts[1]?.targetOperation).toBeUndefined();
});

it('polls an active producer after restart and skips the part when its gateway receipt arrives', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.setRevision(2n);
	state.activePart(2, 'target-request-part-2', 2);
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'restart-receiving-1', requestId: 'request-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({
			partNumber, sizeBytes, sha256Hex, md5Base64,
			...(partNumber === 2 ? { targetOperation: { attemptId: 'attempt-1', requestId: 'target-request-part-2', expectedRevision: 1n, operationId: 'target-request-part-2', generation: 1n } } : {})
		})),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 2n, phase: 'paused'
	};
	await store.put(local);
	const restarted = controller(store, rpc, { readinessPollMs: 1 });
	const result = await restarted.resume(local.localId, fakeFile());

	expect(result.phase).toBe('completed');
	expect(methods.getMultipartPartTarget.mock.calls.some(([request]) => request.partNumber === 2)).toBe(false);
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
});

it('does not create a replacement target when a leased part has no persisted request identity', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.leasePart(2, 'unknown-target-request', 1n, 'unknown-target-request');
	state.setRevision(2n);
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'legacy-lease-1', requestId: 'request-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64 })),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 2n, phase: 'paused'
	};
	await store.put(local);
	const restarted = controller(store, rpc);
	await expect(restarted.resume(local.localId, fakeFile())).rejects.toMatchObject({ name: 'MultipartOutcomeUnknownError', partNumber: 2 });
	expect(methods.getMultipartPartTarget).not.toHaveBeenCalled();
});

it('replaces a closed no-write target only after the backend reports producer closure', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	state.leasePart(2, 'old-target-request', 1n, 'old-target-request');
	state.closePartNoWrite(2);
	state.setRevision(2n);
	const local: PersistedMultipartSession = {
		ownerId: 'user-1', localId: 'closed-no-write-1', requestId: 'request-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize,
		partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex, md5Base64 }) => ({
			partNumber, sizeBytes, sha256Hex, md5Base64,
			...(partNumber === 2 ? { targetOperation: { attemptId: 'attempt-1', requestId: 'old-target-request', expectedRevision: 1n, operationId: 'old-target-request', generation: 1n } } : {})
		})),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 2n, phase: 'paused'
	};
	await store.put(local);
	const restarted = controller(store, rpc);
	const result = await restarted.resume(local.localId, fakeFile());
	const partTwo = methods.getMultipartPartTarget.mock.calls.find(([request]) => request.partNumber === 2)?.[0];
	expect(result.phase).toBe('completed');
	expect(partTwo?.requestId).not.toBe('old-target-request');
	expect(partTwo?.expectedRevision).toBeGreaterThan(1n);
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
});

it('aborts hashing and prevents RPC when the account changes', async () => {
	const store = new MemoryStore();
	const { rpc } = createRpc();
	let signal: AbortSignal | undefined;
	const subject = controller(store, rpc, {
		hash: (_file, abortSignal) => new Promise((_resolve, reject) => {
			signal = abortSignal;
			abortSignal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
		})
	});
	const pending = subject.start(fakeFile(), { spaceId: 'space-1' });
	await vi.waitFor(() => expect(signal).toBeDefined());
	subject.setAccountId('user-2');
	await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
	expect(signal?.aborted).toBe(true);
	expect(rpc.beginMultipartUpload).not.toHaveBeenCalled();
});

it('keeps only one bounded part slice active at a time', async () => {
	const store = new MemoryStore();
	const { rpc } = createRpc();
	let active = 0;
	let maximum = 0;
	let releasePair!: () => void;
	const pairReady = new Promise<void>((resolve) => { releasePair = resolve; });
	const subject = controller(store, rpc, {
		put: async (blob) => {
			active++;
			maximum = Math.max(maximum, active);
			expect(blob.size).toBeLessThanOrEqual(MULTIPART_PART_BYTES);
			if (active === 2) releasePair();
			await pairReady;
			active--;
		}
	});
	await subject.start(fakeFile(), { spaceId: 'space-1' });
	expect(maximum).toBe(2);
});

it('does not invoke Auto retry when the browser is offline', async () => {
	const store = new MemoryStore();
	const { rpc } = createRpc();
	const subject = controller(store, rpc, { isOnline: () => false });
	await expect(subject.start(fakeFile(), { spaceId: 'space-1' })).rejects.toBeInstanceOf(MultipartOfflineError);
	expect(rpc.beginMultipartUpload).not.toHaveBeenCalled();
	expect(rpc.retryMultipartUpload).not.toHaveBeenCalled();
});

it('does not switch storage after a client-side transport failure to the shared receiver', async () => {
	const store = new MemoryStore();
	const { rpc } = createRpc();
	const subject = controller(store, rpc, { put: async () => { throw new UploadTransportError(); }, maxPartRetries: 1 });
	await expect(subject.start(fakeFile(), { spaceId: 'space-1' }, UploadMode.AUTO)).rejects.toBeInstanceOf(UploadTransportError);
	expect(rpc.retryMultipartUpload).not.toHaveBeenCalled();
});

it('does not switch storage for generic receiver 5xx responses', async () => {
	const store = new MemoryStore();
	const { rpc } = createRpc();
	const put = vi.fn(async () => { throw new UploadTargetError(503); });
	const subject = controller(store, rpc, { put, maxPartRetries: 2 });
	await expect(subject.start(fakeFile(), { spaceId: 'space-1' }, UploadMode.AUTO)).rejects.toBeInstanceOf(UploadTargetError);
	expect(rpc.retryMultipartUpload).not.toHaveBeenCalled();
	expect(put.mock.calls.length).toBeGreaterThan(0);
	expect(put.mock.calls.length).toBeLessThanOrEqual(4);
});

it('restarts every part on one Auto fallback and never sends more than two PUTs concurrently', async () => {
	const store = new MemoryStore();
	const { rpc, methods, state } = createRpc();
	let active = 0;
	let maximum = 0;
	const put = vi.fn(async (_blob, url: string) => {
		active++;
		maximum = Math.max(maximum, active);
		try {
			if (url.includes('/attempt-1/')) {
				const partNumber = Number(url.match(/part-(\d+)/)?.[1]);
				state.unknown().add(partNumber);
				state.setFailureCode('STORAGE_UNAVAILABLE');
				throw new UploadTargetError(503, '{"code":"STORAGE_UNAVAILABLE"}');
			}
			await Promise.resolve();
		} finally {
			active--;
		}
	});
	const subject = controller(store, rpc, { put, maxPartRetries: 3 });
	const result = await subject.start(fakeFile(), { spaceId: 'space-1' }, UploadMode.AUTO);
	expect(result.phase).toBe('completed');
	expect(result.fallbackUsed).toBe(true);
	expect(rpc.retryMultipartUpload).toHaveBeenCalledTimes(1);
	expect(state.unknown()).toEqual(new Set([1, 2]));
	expect(state.confirmed()).toEqual(new Set([1, 2, 3, 4]));
	expect(put).toHaveBeenCalledTimes(6);
	expect(methods.getMultipartPartTarget.mock.calls.map(([request]) => request.partNumber)).toEqual([1, 2, 1, 2, 3, 4]);
	expect(maximum).toBeLessThanOrEqual(2);
});


it('discards a pending Begin only after a trusted definitive name conflict', async () => {
	const store=new MemoryStore();
	const {rpc,methods}=createRpc();
	methods.beginMultipartUpload.mockRejectedValueOnce(new ConnectError('NAME_CONFLICT',Code.Aborted,undefined,[{desc:UploadErrorDetailSchema,value:create(UploadErrorDetailSchema,{code:'NAME_CONFLICT',requestId:'test'})}]));
	const subject=controller(store,rpc);
	await expect(subject.start(fakeFile(),{spaceId:'space-1'},UploadMode.R2,'local-conflict')).rejects.toBeInstanceOf(MultipartNameConflictError);
	expect(methods.beginMultipartUpload).toHaveBeenCalledWith(expect.objectContaining({supportsNameConflict:true}));
	expect(await store.get('user-1','local-conflict')).toBeUndefined();
});

it('forgets a failed name-conflict session only after a fresh terminal server response', async () => {
	const store=new MemoryStore();
	const {rpc,methods}=createRpc();
	const local: PersistedMultipartSession={ownerId:'user-1',localId:'failed-conflict',requestId:'request-1',uploadId:'upload-1',spaceId:'space-1',name:'large.bin',sizeBytes:fileSize,partSizeBytes:MULTIPART_PART_BYTES,fingerprintHex:manifest.fingerprintHex,parts:manifest.parts.map(({partNumber,sizeBytes,sha256Hex,md5Base64})=>({partNumber,sizeBytes,sha256Hex,md5Base64})),uploadMode:UploadMode.R2,attemptNumber:1,attemptId:'attempt-1',revision:1n,phase:'verifying'};
	await store.put(local);
	methods.getMultipartUpload.mockResolvedValueOnce({session:remoteSession(local,{state:MultipartUploadState.OPEN,failureCode:''}),parts:[],nextPartNumberCursor:0,hasMoreParts:false} as never);
	const subject=controller(store,rpc);
	await expect(subject.forgetNameConflict(local.localId)).rejects.toThrow('Nie potwierdzono');
	expect(await store.get('user-1',local.localId)).toBeDefined();
	methods.getMultipartUpload.mockResolvedValueOnce({session:remoteSession(local,{state:MultipartUploadState.FAILED,failureCode:'NAME_CONFLICT'}),parts:[],nextPartNumberCursor:0,hasMoreParts:false} as never);
	await subject.forgetNameConflict(local.localId);
	expect(await store.get('user-1',local.localId)).toBeUndefined();
	expect(methods.cancelMultipartUpload).not.toHaveBeenCalled();
});
