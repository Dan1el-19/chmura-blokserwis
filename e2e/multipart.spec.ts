import { expect, test, type Page, type Route } from 'playwright/test';
import { closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PART_BYTES = 33_554_432;
const LARGE_FILE_BYTES = PART_BYTES * 3 + 1;
const temporaryDirectories = new Set<string>();

test.afterEach(() => {
	for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
	temporaryDirectories.clear();
});

type MockOptions = {
	initialReadyPolls?: number;
	retryReadyPolls?: number;
	holdParts?: number[];
	failFirstPut?: 'provider' | 'gateway';
};

type MockControl = {
	events: string[];
	confirmedByAttempt: Map<number, Set<number>>;
	putStarted: Promise<void>;
	releasePuts(): void;
	getState(): { failureCode: string; retryCount: number; maxConcurrent: number; currentAttempt: number };
};

async function installBrowserMocks(page: Page, options: MockOptions = {}): Promise<MockControl> {
	const events: string[] = [];
	const uploadedEntries: Record<string, unknown>[] = [];
	const confirmedByAttempt = new Map<number, Set<number>>();
	const targetsByAttempt = new Map<number, Map<number, { sha256Hex: string; requestId: string; operationId: string }>>();
	let currentAttempt = 1;
	let revision = 1;
	let uploadState = 1; // OPEN
	let ready = false;
	let remainingReadyPolls = options.initialReadyPolls ?? 0;
	let failureCode = '';
	let retryCount = 0;
	let manifestFingerprintHex = '';
	let manifestParts = new Map<number, { sizeBytes: string; sha256Hex: string; md5Base64: string }>();
	let activePuts = 0;
	let maxConcurrent = 0;
	let putStarted!: () => void;
	let releasePuts!: () => void;
	const putStartedPromise = new Promise<void>((resolve) => { putStarted = resolve; });
	const putGate = new Promise<void>((resolve) => { releasePuts = resolve; });

	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'multipart-e2e-user' },
				session: { id: 'multipart-e2e-session', status: 'active', getToken: async () => 'multipart-e2e-token' },
				load: async () => {},
				addListener: () => () => {},
				signOut: async () => {}
			}
		});
	});

	const currentConfirmed = () => {
		let parts = confirmedByAttempt.get(currentAttempt);
		if (!parts) confirmedByAttempt.set(currentAttempt, (parts = new Set()));
		return parts;
	};
	const session = () => ({
		id: 'multipart-upload-1',
		spaceId: 'personal',
		name: 'sparse.bin',
		sizeBytes: String(LARGE_FILE_BYTES),
		protocol: 1,
		manifestFingerprintHex,
		state: uploadState,
		revision: String(revision),
		attemptId: `attempt-${currentAttempt}`,
		attemptNumber: currentAttempt,
		storageLocation: currentAttempt === 1 ? 1 : 2,
		cleanupPending: false,
		failureCode,
		readyForParts: ready,
		...(uploadState === 4 ? { entry: uploadedEntries[0] } : {})
	});
	const commonHeaders = {
		'access-control-allow-origin': '*',
		'access-control-allow-headers': '*',
		'access-control-allow-methods': 'POST, OPTIONS, PUT',
		'content-type': 'application/json'
	};

	await page.route('http://localhost:8787/**', async (route: Route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: commonHeaders });
			return;
		}
		const method = request.url().split('/').at(-1)!;
		const body = request.postDataJSON() as Record<string, unknown>;
		events.push(`rpc:${method}`);
		let result: Record<string, unknown> = {};
		switch (method) {
			case 'GetMe':
				break;
			case 'GetSpaces':
				result = { spaces: [{ id: 'personal', kind: 2 }] };
				break;
			case 'GetUploadLimits':
				result = {
					maxUploadBytes: '100000000',
					canManage: false,
					multipart: {
						enabled: true,
						maxFileBytes: '10000000000',
						partSizeBytes: String(PART_BYTES),
						maxParallelParts: 2,
						protocol: 'MULTIPART_V1'
					}
				};
				break;
			case 'ListEntries':
				result = { entries: uploadedEntries, nextPageToken: '' };
				break;
			case 'BeginMultipartUpload': {
				const parts = body.manifestParts as { partNumber: number; sizeBytes: string; sha256Hex: string; md5Base64: string }[];
				manifestParts = new Map(parts.map((part) => [part.partNumber, part]));
				manifestFingerprintHex = (body.manifestFingerprintHex as string) || '';
				const created = {
					...session(),
					spaceId: body.spaceId,
					name: body.name,
					sizeBytes: String(body.sizeBytes),
					manifestFingerprintHex,
					readyForParts: ready
				};
				// Hold the manifest independently of File bytes and return only protocol metadata.
				Object.assign(created, { parts });
				events.push('begin');
				result = { session: created, partSizeBytes: String(PART_BYTES), maxParallelParts: 2 };
				break;
			}
			case 'GetMultipartUpload': {
				if (!ready && !failureCode) {
					if (remainingReadyPolls > 0) remainingReadyPolls--;
					else ready = true;
				}
				events.push(`session:${ready ? 'ready' : failureCode || 'waiting'}`);
				const parts = (Array.from({ length: 4 }, (_, index) => index + 1)).map((partNumber) => {
					const expected = manifestParts.get(partNumber)!;
					const targetOperation = targetsByAttempt.get(currentAttempt)?.get(partNumber);
					return currentConfirmed().has(partNumber)
						? { partNumber, state: 3, sizeBytes: expected.sizeBytes, sha256Hex: expected.sha256Hex, sha256Origin: 2, md5Base64: expected.md5Base64, etag: `etag-${partNumber}`, generation: '1', operationId: targetOperation?.operationId ?? `op-${currentAttempt}-${partNumber}` }
						: { partNumber, state: 1, sizeBytes: expected.sizeBytes, sha256Hex: targetOperation ? expected.sha256Hex : '', sha256Origin: targetOperation ? 1 : 0, md5Base64: targetOperation ? expected.md5Base64 : '', etag: '', generation: targetOperation ? '1' : '0', operationId: targetOperation?.operationId ?? '' };
				});
				result = { session: session(), parts, nextPartNumberCursor: 0, hasMoreParts: false, verificationState: 0 };
				break;
			}
			case 'GetMultipartPartTarget': {
				if (!ready) throw new Error('Browser requested a part target before provider initialization.');
				const partNumber = Number(body.partNumber);
				events.push(`target:${currentAttempt}:${partNumber}`);
				events.push(`targetreq:${currentAttempt}:${partNumber}:${String(body.requestId)}`);
				let attemptTargets = targetsByAttempt.get(currentAttempt);
				if (!attemptTargets) targetsByAttempt.set(currentAttempt, (attemptTargets = new Map()));
				const operationId = String(body.requestId);
				const existingOperation = attemptTargets.get(partNumber);
				if (existingOperation && (existingOperation.requestId !== body.requestId || existingOperation.sha256Hex !== body.sha256Hex)) {
					throw new Error('A leased part target must be replayed with the same request ID and content digest.');
				}
				if (!existingOperation) {
					attemptTargets.set(partNumber, { sha256Hex: body.sha256Hex as string, requestId: String(body.requestId), operationId });
					revision++;
				}
				result = {
					session: session(),
					part: {
						partNumber,
						state: 1,
						sizeBytes: String(body.sizeBytes),
						sha256Hex: body.sha256Hex,
						sha256Origin: 1,
						md5Base64: body.md5Base64,
						etag: '',
						generation: '1',
						operationId: existingOperation?.operationId ?? operationId
					},
					target: { url: `http://127.0.0.1:3100/__test-multipart/${currentAttempt}/${partNumber}`, headers: { 'Content-MD5': body.md5Base64 } }
				};
				break;
			}
			case 'ConfirmMultipartPart': {
				const partNumber = Number(body.partNumber);
				currentConfirmed().add(partNumber);
				events.push(`confirmed:${currentAttempt}:${partNumber}`);
				const expected = targetsByAttempt.get(currentAttempt)?.get(partNumber)?.sha256Hex ?? '';
				result = {
					session: session(),
					part: {
						partNumber,
						state: 3,
						sizeBytes: manifestParts.get(partNumber)!.sizeBytes,
						sha256Hex: expected,
						sha256Origin: 2,
						md5Base64: body.md5Base64 || `md5-${partNumber}`,
						etag: `etag-${partNumber}`,
						generation: '1',
						operationId: body.operationId
					}
				};
				break;
			}
			case 'CompleteMultipartUpload': {
				uploadState = 4;
				const entry = { id: 'entry-multipart-1', spaceId: 'personal', name: 'sparse.bin', kind: 2, sizeBytes: String(LARGE_FILE_BYTES), revision: 1, storageLocation: currentAttempt === 1 ? 1 : 2 };
				uploadedEntries.splice(0, uploadedEntries.length, entry);
				result = { session: session(), entry };
				break;
			}
			case 'RetryMultipartUpload': {
				if (failureCode !== 'STORAGE_UNAVAILABLE') throw new Error('RetryMultipartUpload requires trusted STORAGE_UNAVAILABLE session state.');
				events.push('retry');
				retryCount++;
				currentAttempt++;
				targetsByAttempt.clear();
				confirmedByAttempt.set(currentAttempt, new Set());
				uploadState = 1;
				failureCode = '';
				ready = false;
				remainingReadyPolls = options.retryReadyPolls ?? 0;
				revision++;
				result = { session: session(), partSizeBytes: String(PART_BYTES), maxParallelParts: 2 };
				break;
			}
			case 'CancelMultipartUpload':
				uploadState = 5;
				result = { session: session() };
				break;
			default:
				throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers: commonHeaders, body: JSON.stringify(result) });
	});

	await page.route('http://127.0.0.1:3100/__test-multipart/**', async (route) => {
		const [, attemptText, partText] = new URL(route.request().url()).pathname.split('/').slice(-3);
		const attempt = Number(attemptText);
		const partNumber = Number(partText);
		activePuts++;
		maxConcurrent = Math.max(maxConcurrent, activePuts);
		putStarted();
		events.push(`put:${attempt}:${partNumber}:${options.failFirstPut ?? 'none'}`);
		try {
			if (attempt === 1 && options.failFirstPut === 'provider') {
				failureCode = 'STORAGE_UNAVAILABLE';
				await route.fulfill({ status: 503, body: JSON.stringify({ code: 'STORAGE_UNAVAILABLE' }) });
				return;
			}
			if (attempt === 1 && options.failFirstPut === 'gateway') {
				await route.fulfill({ status: 503, body: JSON.stringify({ code: 'GATEWAY_UNAVAILABLE' }) });
				return;
			}
			if (attempt === 1 && options.holdParts?.includes(partNumber)) await putGate;
			await route.fulfill({ status: 200, body: '' });
		} catch {
			// Pausing or reloading aborts the browser's XHR; the route is test-owned.
		} finally {
			activePuts--;
		}
	});

	return {
		events,
		confirmedByAttempt,
		putStarted: putStartedPromise,
		releasePuts,
		getState: () => ({ failureCode, retryCount, maxConcurrent, currentAttempt })
	};
}

function makeSparseFixture(directory: string, name: string, firstByte: number): string {
	mkdirSync(directory, { recursive: true });
	const path = join(directory, name);
	const fd = openSync(path, 'w');
	if (firstByte) writeSync(fd, Buffer.from([firstByte]), 0, 1, 0);
	ftruncateSync(fd, LARGE_FILE_BYTES);
	closeSync(fd);
	return path;
}

test.describe('multipart transfer UI over the browser RPC and XHR flow', () => {
	test('pauses, restores, rejects a wrong file, then resumes only unconfirmed parts', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium', 'Run the large sparse-file wire fixture once in Chromium.');
		const directory = mkdtempSync(join(tmpdir(), 'unisource-multipart-e2e-'));
		temporaryDirectories.add(directory);
		const correct = makeSparseFixture(join(directory, 'correct'), 'sparse.bin', 0);
		const wrong = makeSparseFixture(join(directory, 'wrong'), 'sparse.bin', 1);
		const mock = await installBrowserMocks(page, { holdParts: [2, 3, 4] });
		await page.goto('/personal');
		await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeVisible({ timeout: 15_000 });
		await page.getByLabel('Wybierz pliki do przesłania').setInputFiles(correct);
		await mock.putStarted;
		await expect(page.getByRole('region', { name: 'Transfery' })).toContainText('sparse.bin');
		await expect(page.getByRole('progressbar', { name: 'Postęp sparse.bin' })).toBeVisible();
		await expect.poll(() => mock.events.includes('confirmed:1:1')).toBe(true);
		const partTwoTargetRequestsBeforeRestart = mock.events.filter((event) => event.startsWith('targetreq:1:2:'));
		expect(partTwoTargetRequestsBeforeRestart).toHaveLength(1);
		await page.getByRole('button', { name: 'Wstrzymaj' }).click();
		await expect(page.getByRole('status')).toContainText('Wstrzymano');
		mock.releasePuts();
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeVisible({ timeout: 15_000 });
		const restoredFile = page.getByLabel('Wybierz plik do wznowienia: sparse.bin');
		await expect(restoredFile).toBeVisible();
		const targetCountBeforeWrongFile = mock.events.filter((event) => event.startsWith('target:')).length;
		await restoredFile.setInputFiles(wrong);
		await expect(page.getByRole('alert')).toContainText('nie odpowiada zapisanej sesji');
		expect(mock.events.filter((event) => event.startsWith('target:')).length).toBe(targetCountBeforeWrongFile);
		const targetEventsBeforeResume = mock.events.filter((event) => event.startsWith('target:')).length;
		await page.getByLabel('Wybierz plik do wznowienia: sparse.bin').setInputFiles(correct);
		await expect(page.getByRole('status')).toContainText('Przesłano', { timeout: 20_000 });
		await expect(page.getByRole('table').getByText('sparse.bin', { exact: true })).toBeVisible();
		expect(mock.events.filter((event) => event === 'target:1:1')).toHaveLength(1);
		const resumedTargets = mock.events.filter((event) => event.startsWith('target:')).slice(targetEventsBeforeResume);
		expect(resumedTargets.map((event) => Number(event.split(':')[2])).sort()).toEqual([2, 3, 4]);
		const partTwoTargetRequests = mock.events.filter((event) => event.startsWith('targetreq:1:2:'));
		expect(partTwoTargetRequests).toHaveLength(2);
		expect(partTwoTargetRequests[1]).toBe(partTwoTargetRequests[0]);
	});

	test('waits for storage readiness, limits PUT concurrency to two, and performs one trusted Auto switch', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium', 'Run the large sparse-file wire fixture once in Chromium.');
		test.setTimeout(60_000);
		const directory = mkdtempSync(join(tmpdir(), 'unisource-multipart-e2e-'));
		temporaryDirectories.add(directory);
		const file = makeSparseFixture(directory, 'sparse.bin', 0);
		const mock = await installBrowserMocks(page, { initialReadyPolls: 2, retryReadyPolls: 2, failFirstPut: 'provider' });
		await page.goto('/personal');
		await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeVisible({ timeout: 15_000 });
		await page.getByLabel('Wybierz pliki do przesłania').setInputFiles(file);
		await mock.putStarted;
		await expect(page.getByRole('status')).toContainText('Przesłano', { timeout: 45_000 });
		const firstTarget = mock.events.findIndex((event) => event.startsWith('target:1:'));
		const readyPoll = mock.events.findIndex((event) => event === 'session:ready');
		expect(readyPoll).toBeGreaterThanOrEqual(0);
		expect(firstTarget).toBeGreaterThan(readyPoll);
		expect(mock.events.filter((event) => event === 'retry')).toHaveLength(1);
		expect(mock.events.filter((event) => event.startsWith('target:2:')).map((event) => Number(event.split(':')[2])).sort()).toEqual([1, 2, 3, 4]);
		expect(mock.getState().retryCount).toBe(1);
		expect(mock.getState().maxConcurrent).toBeLessThanOrEqual(2);
		expect(mock.getState().maxConcurrent).toBe(2);
	});

	test('does not Auto switch on a generic gateway 503', async ({ page }, testInfo) => {
		test.skip(testInfo.project.name !== 'chromium', 'Run the large sparse-file wire fixture once in Chromium.');
		test.setTimeout(60_000);
		const directory = mkdtempSync(join(tmpdir(), 'unisource-multipart-e2e-'));
		temporaryDirectories.add(directory);
		const file = makeSparseFixture(directory, 'sparse.bin', 0);
		const mock = await installBrowserMocks(page, { failFirstPut: 'gateway' });
		await page.goto('/personal');
		await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeVisible({ timeout: 15_000 });
		await page.getByLabel('Wybierz pliki do przesłania').setInputFiles(file);
		await mock.putStarted;
		await expect(page.getByRole('alert')).toContainText('HTTP 503', { timeout: 45_000 });
		expect(mock.events).not.toContain('retry');
		expect(mock.getState().retryCount).toBe(0);
	});
});
