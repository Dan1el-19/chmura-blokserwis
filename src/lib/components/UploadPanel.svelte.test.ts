import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { UploadMode } from '#lib/gen/unisourcecfl/upload/v1/upload_pb.js';
import {
	MultipartDigestOrigin,
	MultipartPartState,
	MultipartProtocol,
	MultipartUploadState,
	type MultipartPart
} from '#lib/gen/unisourcecfl/upload/v1/multipart_pb.js';
import { EntryKind, SpaceKind, StorageLocation } from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { CloudState } from '#lib/cloud-state.svelte.js';
import type { MultipartControllerOptions, MultipartRpc } from '#lib/multipart/controller.js';
import { MULTIPART_PART_BYTES } from '#lib/multipart/protocol.js';
import type { MultipartSessionStore, PersistedMultipartSession } from '#lib/multipart/session-store.js';
import { UploadTargetError } from '#lib/upload.js';
import UploadPanel from './UploadPanel.svelte';

const fixture = vi.hoisted(() => ({
	getUploadLimits: vi.fn(),
	listEntries: vi.fn(),
	createUpload: vi.fn(),
	completeUpload: vi.fn(),
	cancelUpload: vi.fn(),
	uploadToTarget: vi.fn()
}));
vi.mock('#lib/api.js', () => ({
	identity: { getMe: vi.fn().mockResolvedValue({}) },
	catalog: { getSpaces: vi.fn().mockResolvedValue({ spaces: [] }), listEntries: fixture.listEntries },
	trash: {},
	storageSettings: { getUploadLimits: fixture.getUploadLimits },
	uploads: {
		createUpload: fixture.createUpload,
		completeUpload: fixture.completeUpload,
		cancelUpload: fixture.cancelUpload
	},
	multipartUploads: {}
}));
vi.mock('#lib/upload.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/upload.js')>()),
	calculateMd5Base64: vi.fn().mockResolvedValue('md5'),
	uploadToTarget: fixture.uploadToTarget
}));

const fileSize = 100_000_001;
const partSizes = [MULTIPART_PART_BYTES, MULTIPART_PART_BYTES, fileSize - 2 * MULTIPART_PART_BYTES];
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
const multipartEnabled = {
	enabled: true,
	maxFileBytes: 10_000_000_000n,
	partSizeBytes: BigInt(MULTIPART_PART_BYTES),
	maxParallelParts: 2,
	protocol: 'MULTIPART_V1'
};

beforeEach(() => {
	vi.resetAllMocks();
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false });
	fixture.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	fixture.createUpload.mockResolvedValue({ session: { id: 'legacy-1', state: 1, attemptId: 'attempt-1', storageLocation: StorageLocation.R2 }, target: { url: 'https://legacy.example', headers: {} } });
	fixture.completeUpload.mockResolvedValue({});
	fixture.cancelUpload.mockResolvedValue({});
	fixture.uploadToTarget.mockResolvedValue(undefined);
});

class MemoryStore implements MultipartSessionStore {
	readonly values = new Map<string, PersistedMultipartSession>();
	async put(session: PersistedMultipartSession) { this.values.set(`${session.ownerId}:${session.localId}`, structuredClone(session)); }
	async get(ownerId: string, localId: string) { return this.values.get(`${ownerId}:${localId}`); }
	async list(ownerId: string) { return [...this.values.values()].filter((session) => session.ownerId === ownerId); }
	async delete(ownerId: string, localId: string) { this.values.delete(`${ownerId}:${localId}`); }
}

function fakeFile(name = 'large.bin', lastModified = 1): File {
	return {
		name,
		size: fileSize,
		lastModified,
		slice: (start: number, end: number) => ({ size: end - start })
	} as File;
}

function partFor(partNumber: number, state: MultipartPartState, operation?: { requestId: string; operationId: string }): MultipartPart {
	const expected = manifest.parts[partNumber - 1]!;
	return {
		partNumber,
		state,
		sizeBytes: BigInt(expected.sizeBytes),
		sha256Hex: state === MultipartPartState.MISSING && !operation ? '' : expected.sha256Hex,
		sha256Origin: state === MultipartPartState.CONFIRMED ? MultipartDigestOrigin.GATEWAY_RECEIPT : MultipartDigestOrigin.UNSPECIFIED,
		md5Base64: state === MultipartPartState.MISSING && !operation ? '' : expected.md5Base64,
		etag: state === MultipartPartState.CONFIRMED ? `etag-${partNumber}` : '',
		generation: operation || state === MultipartPartState.CONFIRMED ? 1n : 0n,
		operationId: operation?.operationId ?? (state === MultipartPartState.CONFIRMED ? `operation-${partNumber}` : '')
	} as MultipartPart;
}

function makeRpc(options: { confirmed?: number[]; verifying?: boolean; readyAfterPolls?: number; failureCode?: string } = {}) {
	const confirmed = new Set(options.confirmed ?? []);
	let revision = 1n;
	let state = MultipartUploadState.OPEN;
	let ready = (options.readyAfterPolls ?? 0) === 0 && !options.failureCode;
	let readinessPolls = 0;
	let failureCode = options.failureCode;
	let attemptNumber = 1;
	const targetOperations = new Map<number, Map<number, { requestId: string; operationId: string }>>();
	const operationsForAttempt = () => {
		let operations = targetOperations.get(attemptNumber);
		if (!operations) targetOperations.set(attemptNumber, (operations = new Map()));
		return operations;
	};
	let completionReadCount = 0;
	let finishVerification!: () => void;
	const verificationGate = new Promise<void>((resolve) => { finishVerification = resolve; });
	const currentSession = (): Record<string, unknown> => ({
		id: 'upload-1',
		spaceId: 'space-1',
		name: 'large.bin',
		sizeBytes: BigInt(fileSize),
		protocol: MultipartProtocol.V1,
		manifestFingerprintHex: manifest.fingerprintHex,
		state,
		revision,
		attemptId: 'attempt-1',
		attemptNumber,
		storageLocation: StorageLocation.R2,
		cleanupPending: false,
		failureCode: failureCode ?? '',
		readyForParts: ready,
		...(state === MultipartUploadState.COMPLETED ? { entry: { id: 'entry-1', spaceId: 'space-1', name: 'large.bin', kind: EntryKind.FILE } } : {})
	} as never);
	const rpc = {
		beginMultipartUpload: vi.fn(async (request) => ({
			session: { ...currentSession(), spaceId: request.spaceId, name: request.name } as never,
			partSizeBytes: BigInt(MULTIPART_PART_BYTES),
			maxParallelParts: 2
		})),
		getMultipartUpload: vi.fn(async () => {
			readinessPolls++;
			if (!failureCode && readinessPolls > (options.readyAfterPolls ?? 0)) ready = true;
			if (options.verifying && state === MultipartUploadState.VERIFYING) {
				completionReadCount++;
				if (completionReadCount > 1) {
					await verificationGate;
					state = MultipartUploadState.COMPLETED;
				}
			}
			return {
				session: currentSession(),
				parts: manifest.parts.map((part) => {
					const operation = operationsForAttempt().get(part.partNumber);
					return partFor(part.partNumber, confirmed.has(part.partNumber) ? MultipartPartState.CONFIRMED : MultipartPartState.MISSING, operation);
				}),
				nextPartNumberCursor: 0,
				hasMoreParts: false,
				verificationState: 0
			};
		}),
		getMultipartPartTarget: vi.fn(async (request) => {
			const operations = operationsForAttempt();
			let operation = operations.get(request.partNumber);
			if (operation && operation.requestId !== request.requestId) throw new Error('Leased target replay must reuse the same request ID.');
			if (!operation) {
				operation = { requestId: request.requestId, operationId: request.requestId };
				operations.set(request.partNumber, operation);
				revision++;
			}
			return {
				session: { ...currentSession(), revision } as never,
				part: { ...partFor(request.partNumber, MultipartPartState.MISSING, operation), sha256Hex: manifest.parts[request.partNumber - 1]!.sha256Hex, md5Base64: manifest.parts[request.partNumber - 1]!.md5Base64, generation: 1n },
				target: { url: `https://storage.example/part-${request.partNumber}`, headers: {} }
			};
		}),
		confirmMultipartPart: vi.fn(async (request) => {
			confirmed.add(request.partNumber);
			return { session: { ...currentSession(), revision } as never, part: partFor(request.partNumber, MultipartPartState.CONFIRMED) };
		}),
		completeMultipartUpload: vi.fn(async () => {
			state = options.verifying ? MultipartUploadState.VERIFYING : MultipartUploadState.COMPLETED;
			return { session: currentSession(), entry: undefined };
		}),
		cancelMultipartUpload: vi.fn(async () => ({ session: currentSession() })),
		retryMultipartUpload: vi.fn(async () => {
			failureCode = undefined;
			attemptNumber++;
			targetOperations.set(attemptNumber, new Map());
			ready = true;
			state = MultipartUploadState.OPEN;
			return { session: currentSession(), partSizeBytes: BigInt(MULTIPART_PART_BYTES), maxParallelParts: 2 };
		})
	};
	return { rpc: rpc as unknown as MultipartRpc, methods: rpc, confirmed, releaseVerification: finishVerification };
}

function createState(
	store: MemoryStore,
	rpc: MultipartRpc,
	hash: NonNullable<MultipartControllerOptions['hash']> = async () => manifest,
	put: NonNullable<MultipartControllerOptions['put']> = async () => {}
) {
	const state = new CloudState({ multipart: { rpc, store, hash, put } });
	state.activate('alice');
	return state;
}

it('keeps small files on legacy single PUT even when multipart capability is enabled', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	fixture.createUpload.mockResolvedValue({ session: { id: 'legacy-1', state: 1, attemptId: 'attempt-1', storageLocation: StorageLocation.R2 }, target: { url: 'https://legacy.example', headers: {} } });
	fixture.completeUpload.mockResolvedValue({});
	fixture.uploadToTarget.mockResolvedValue(undefined);
	const { rpc, methods } = makeRpc();
	const state = createState(new MemoryStore(), rpc);
	await state.loadUploadLimit();
	state.transfers.enqueue([new File(['small'], 'small.txt')], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	await expect.poll(() => state.transfers.tasks[0]?.phase, { timeout: 5000 }).toBe('done');
	expect(fixture.createUpload).toHaveBeenCalledTimes(1);
	expect(methods.beginMultipartUpload).not.toHaveBeenCalled();
});

it('keeps large-file creation disabled when multipart capability is missing', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false });
	const { rpc, methods } = makeRpc();
	const state = createState(new MemoryStore(), rpc);
	await state.loadUploadLimit();
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	expect(state.transfers.tasks[0]?.phase).toBe('error');
	expect(methods.beginMultipartUpload).not.toHaveBeenCalled();
	expect(state.multipartCapabilities).toBeUndefined();
});

it('waits for provider initialization before requesting any part targets', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	const { rpc, methods } = makeRpc({ readyAfterPolls: 2 });
	const state = createState(new MemoryStore(), rpc);
	await state.loadUploadLimit();
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	await expect.poll(() => state.transfers.tasks[0]?.phase, { timeout: 5000 }).toBe('done');
	expect(methods.getMultipartPartTarget).toHaveBeenCalled();
	expect(methods.getMultipartUpload.mock.invocationCallOrder[2]).toBeLessThan(methods.getMultipartPartTarget.mock.invocationCallOrder[0]!);
});

it('uses trusted session STORAGE_UNAVAILABLE to authorize one Auto provider retry', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	const { rpc, methods } = makeRpc({ failureCode: 'STORAGE_UNAVAILABLE' });
	const state = createState(new MemoryStore(), rpc);
	await state.loadUploadLimit();
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	await expect.poll(() => state.transfers.tasks[0]?.phase).toBe('done');
	expect(methods.retryMultipartUpload).toHaveBeenCalledTimes(1);
	expect(methods.getMultipartPartTarget).toHaveBeenCalled();
});

it('does not switch providers from an HTTP body without trusted session classification', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	const { rpc, methods } = makeRpc();
	let failOnce = true;
	const put = async () => {
		if (failOnce) {
			failOnce = false;
			throw new UploadTargetError(503, JSON.stringify({ code: 'STORAGE_UNAVAILABLE' }));
		}
	};
	const state = createState(new MemoryStore(), rpc, async () => manifest, put);
	await state.loadUploadLimit();
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	await expect.poll(() => state.transfers.tasks[0]?.phase).toBe('error');
	expect(methods.retryMultipartUpload).not.toHaveBeenCalled();
});

it('restores an owner-scoped session, keeps it after a wrong file, and resumes only missing parts', async () => {
	const store = new MemoryStore();
	const { rpc, methods, confirmed } = makeRpc({ confirmed: [1] });
	await store.put({
		ownerId: 'alice', localId: 'saved-1', requestId: 'begin-1', uploadId: 'upload-1',
		spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize, partSizeBytes: MULTIPART_PART_BYTES,
		fingerprintHex: manifest.fingerprintHex,
		parts: manifest.parts.map(({ partNumber, sizeBytes, sha256Hex }) => ({ partNumber, sizeBytes, sha256Hex, md5Base64: `md5-${partNumber}` })),
		uploadMode: UploadMode.AUTO, attemptId: 'attempt-1', attemptNumber: 1, revision: 1n, phase: 'paused'
	});
	const state = createState(store, rpc, async (file) => (file as File).lastModified === 2 ? { ...manifest, fingerprintHex: '0'.repeat(64) } : manifest);
	const screen = await render(UploadPanel, { props: { manager: state.transfers } });
	await expect.poll(() => state.transfers.tasks.some((task) => task.id === 'saved-1')).toBe(true);
	const task = state.transfers.tasks.find((item) => item.id === 'saved-1')!;
	expect(task.phase).toBe('needsFile');
	state.transfers.resume('saved-1', fakeFile('large.bin', 2));
	await expect.poll(() => task.phase).toBe('needsFile');
	expect(await store.get('alice', 'saved-1')).toMatchObject({ uploadId: 'upload-1', phase: 'paused', fingerprintHex: manifest.fingerprintHex });
	expect(methods.getMultipartUpload).not.toHaveBeenCalled();
	await expect.element(screen.getByRole('button', { name: 'Wybierz plik' })).toBeVisible();
	state.transfers.resume('saved-1', fakeFile());
	await expect.poll(() => task.phase).toBe('done');
	expect(confirmed).toEqual(new Set([1, 2, 3]));
	expect(methods.getMultipartPartTarget.mock.calls.map(([request]) => request.partNumber)).toEqual([2, 3]);
});

it('shows the space name instead of its identifier for a restored transfer', async () => {
	const store = new MemoryStore();
	await store.put({ ownerId: 'alice', localId: 'saved-label', requestId: 'begin', spaceId: 'space-1', name: 'large.bin', sizeBytes: fileSize, partSizeBytes: MULTIPART_PART_BYTES, fingerprintHex: manifest.fingerprintHex, parts: [], uploadMode: UploadMode.AUTO, attemptNumber: 1, revision: 1n, phase: 'paused' });
	const state = createState(store, makeRpc().rpc);
	const screen = await render(UploadPanel, { props: { manager: state.transfers, spaces: [{ id: 'space-1', kind: SpaceKind.SHARED }] } });
	await expect.element(screen.getByText('Main', { exact: true })).toBeVisible();
	expect(screen.container.textContent).not.toContain('space-1');
});

it('shows verifying at 99 percent until the completed session publishes its catalog entry', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	fixture.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	const { rpc, methods, releaseVerification } = makeRpc({ verifying: true });
	const state = createState(new MemoryStore(), rpc);
	await state.loadUploadLimit();
	const list = state.list('files', 'space-1', '');
	state.activeListKey = list.key;
	await state.load(list);
	fixture.listEntries.mockResolvedValue({ entries: [{ id: 'entry-1', name: 'large.bin', kind: EntryKind.FILE }], nextPageToken: '' });
	const screen = await render(UploadPanel, { props: { manager: state.transfers } });
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	await expect.poll(() => state.transfers.tasks[0]?.phase).toBe('verifying');
	const progress = screen.getByRole('progressbar', { name: 'Postęp large.bin' });
	expect(progress.element().getAttribute('aria-valuenow')).toBe('99');
	await expect.element(screen.getByText('Weryfikacja pliku')).toBeVisible();
	await expect.poll(() => methods.getMultipartUpload.mock.calls.length, { timeout: 4000 }).toBeGreaterThanOrEqual(6);
	releaseVerification();
	await expect.poll(() => state.transfers.tasks[0]?.phase).toBe('done');
	await expect.poll(() => list.entries.some((entry) => entry.id === 'entry-1')).toBe(true);
	expect(progress.element().getAttribute('aria-valuenow')).toBe('100');
});

it('aborts an active multipart upload on account change and retains the previous owner metadata', async () => {
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false, multipart: multipartEnabled });
	const store = new MemoryStore();
	const { rpc } = makeRpc();
	let started!: () => void;
	const putStarted = new Promise<void>((resolve) => { started = resolve; });
	const put = async (_blob: Blob, _url: string, _headers: Record<string, string>, signal: AbortSignal) => {
		started();
		await new Promise<void>((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }));
	};
	const state = createState(store, rpc, async () => manifest, put);
	await state.loadUploadLimit();
	state.transfers.enqueue([fakeFile()], { spaceId: 'space-1', mode: UploadMode.AUTO, label: 'Personal' }, 100_000_000);
	const localId = state.transfers.tasks[0]!.id;
	await putStarted;
	state.activate('bob');
	await expect.poll(() => state.transfers.tasks.length).toBe(0);
	expect(state.transfers.tasks).toEqual([]);
	expect(await store.get('alice', localId)).toMatchObject({ ownerId: 'alice', localId, targetLabel: 'Personal' });
	expect(await store.list('bob')).toEqual([]);
});
