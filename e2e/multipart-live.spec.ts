import { expect, test, type BrowserContext, type Page, type Request } from 'playwright/test';
import { chromium } from 'playwright';
import { closeSync, createReadStream, existsSync, ftruncateSync, linkSync, mkdtempSync, mkdirSync, openSync, readSync, rmSync, statSync, utimesSync, writeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageLocation } from '../src/lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { UploadMode } from '../src/lib/gen/unisourcecfl/upload/v1/upload_pb.js';
import { MULTIPART_PART_BYTES } from '../src/lib/multipart/protocol.js';
import {
	createCleanupManifest,
	createSignInTicket,
	loadLiveMultipartConfig,
	persistCleanupManifest,
	reconcileClerkSessions,
	revokeClerkArtifacts,
	validateDedicatedUsers,
	type CleanupManifest,
	type LiveMultipartConfig
} from './multipart-live-auth.js';

// Clerk one-use ticket tokens are passed into the page; never record this spec's
// browser traffic or page state in Playwright artifacts.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('isolated live multipart acceptance', () => {
	test.skip(process.env.E2E_LIVE_MULTIPART !== '1', 'Run only through scripts/run-live-multipart-e2e.sh against the isolated localhost service.');
	test.describe.configure({ mode: 'serial' });
	const configuredFixtureBytes = Number(process.env.E2E_MULTIPART_FIXTURE_BYTES ?? 0);
	test.setTimeout(Number(process.env.E2E_MULTIPART_TEST_TIMEOUT_MS ?? (configuredFixtureBytes >= 1_000_000_000 ? 10_800_000 : 900_000)));

	let config: LiveMultipartConfig;
	let manifest: CleanupManifest;

	test.beforeAll(async () => {
		config = loadLiveMultipartConfig();
		const fixtureStat = statSync(config.fixturePath);
		if (!fixtureStat.isFile() || fixtureStat.size !== config.fixtureBytes) {
			throw new Error(`The isolated multipart fixture must have exactly ${config.fixtureBytes} bytes.`);
		}
		await validateDedicatedUsers(config);
		manifest = createCleanupManifest(config);
		persistCleanupManifest(config.cleanupManifestPath, manifest);
	});

	test.afterEach(async ({ page }, testInfo) => {
		void page;
		if (!manifest) return;
		manifest.testOutcome = testInfo.status === 'passed'
			? 'passed'
			: testInfo.status === 'interrupted'
				? 'interrupted'
				: 'failed';
		persistCleanupManifest(config.cleanupManifestPath, manifest);
	});

	test.afterAll(async () => {
		if (!config || !manifest) return;
		try {
			await reconcileClerkSessions(config, manifest);
		} catch (error) {
			manifest.cleanupErrors.push(`Session reconciliation: ${error instanceof Error ? error.message : 'reconciliation failed'}`);
		}
		await revokeClerkArtifacts(config, manifest);
		for (const upload of manifest.uploads) {
			if (upload.state !== 'cancelled' && upload.state !== 'deleted-and-verified') {
				manifest.cleanupErrors.push(`Upload ${upload.uploadId ?? upload.requestId}: resource cleanup was not verified (state ${upload.state}).`);
			}
		}
		if (manifest.testOutcome === 'running') manifest.testOutcome = 'interrupted';
		manifest.cleanupStatus = manifest.cleanupErrors.length ? 'failed' : 'complete';
		manifest.status = manifest.testOutcome === 'passed' && manifest.cleanupStatus === 'complete' ? 'complete' : 'failed';
		persistCleanupManifest(config.cleanupManifestPath, manifest);
		if (manifest.cleanupErrors.length) throw new Error(`Live multipart cleanup left ${manifest.cleanupErrors.length} Clerk artifact(s) to review in ${config.cleanupManifestPath}.`);
	});

	async function launchProfile(profilePath: string): Promise<{ context: BrowserContext; page: Page }> {
		const context = await chromium.launchPersistentContext(profilePath, {
			headless: process.env.E2E_HEADLESS !== '0',
			viewport: { width: 1440, height: 1000 }
		});
		const page = context.pages()[0] ?? await context.newPage();
		page.setDefaultTimeout(20_000);
		return { context, page };
	}

	async function attachSignIn(page: Page, userId: string): Promise<void> {
		const ticket = await createSignInTicket(config, manifest, userId);
		await page.goto(config.baseUrl);
		await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { client?: { signIn?: unknown } } }).Clerk?.client?.signIn));
		const exchanged = await page.evaluate(async (token) => {
			const clerk = (window as unknown as {
				Clerk?: {
					client: { signIn: { create(params: { strategy: 'ticket'; ticket: string }): Promise<{ status?: string; createdSessionId?: string | null }>; status: string; createdSessionId?: string | null } };
					publishableKey?: string;
				}
			}).Clerk;
			if (!clerk) throw new Error('Clerk client did not initialize.');
			const signIn = clerk.client.signIn;
			let createFailed = false;
			let result: { status?: string; createdSessionId?: string | null } | undefined;
			try {
				result = await signIn.create({ strategy: 'ticket', ticket: token });
			} catch {
				createFailed = true;
			}
			const completedSignIn = result ?? signIn;
			const sessionId = completedSignIn.createdSessionId ?? signIn.createdSessionId ?? '';
			const status = completedSignIn.status ?? signIn.status;
			return {
				complete: !createFailed && status === 'complete' && Boolean(sessionId),
				ticketConsumed: status === 'complete' || Boolean(sessionId),
				sessionId,
				publishableKey: clerk.publishableKey ?? ''
			};
		}, ticket.token);
		const record = manifest.tickets.find((item) => item.id === ticket.id);
		if (exchanged.ticketConsumed) {
			if (record) record.status = 'consumed';
			if (exchanged.sessionId) manifest.sessions.push({ id: exchanged.sessionId, userId, status: 'active' });
		}
		persistCleanupManifest(config.cleanupManifestPath, manifest);
		if (!exchanged.complete || !exchanged.sessionId) throw new Error('Clerk ticket sign-in did not return a completed session.');
		if (exchanged.publishableKey !== config.clerkPublishableKey) throw new Error('The isolated frontend is using a different Clerk development instance key than the ticket issuer.');
		try {
			await page.evaluate(async (sessionId) => {
			const clerk = (window as unknown as {
				Clerk?: {
					setActive(params: { session: string; navigate?: (params: { session: unknown; decorateUrl: (url: string) => string }) => Promise<unknown> | unknown }): Promise<void>;
					user?: { id: string } | null;
					session?: { id: string } | null;
				}
			}).Clerk;
			if (!clerk) throw new Error('Clerk client did not initialize.');
			await clerk.setActive({ session: sessionId, navigate: async () => {} });
			}, exchanged.sessionId);
		} catch (error) {
			// Clerk may finish activation by reloading the current document. In that
			// case Playwright loses only the evaluation context; verify the activated
			// identity below in the replacement document. Surface every other error.
			if (!(error instanceof Error) || !/Execution context was destroyed.*navigation/i.test(error.message)) throw error;
			await page.waitForLoadState('domcontentloaded');
		}
		await page.waitForFunction(({ expectedUserId, expectedSessionId }) => {
			const clerk = (window as unknown as {
				Clerk?: { loaded?: boolean; user?: { id: string } | null; session?: { id: string; status?: string } | null }
			}).Clerk;
			return clerk?.loaded === true && clerk.user?.id === expectedUserId &&
				clerk.session?.id === expectedSessionId && clerk.session.status === 'active';
		}, { expectedUserId: userId, expectedSessionId: exchanged.sessionId }, { timeout: 30_000 });
		await expect(page.getByRole('heading', { name: 'Moje pliki' })).toBeVisible();
	}

	function observeRpc(page: Page, userId: string, uploadName: string, provider: 'R2' | 'RustFS') {
		const events: Array<{ method: string; body: Record<string, unknown>; request: Request; response?: Record<string, unknown> }> = [];
		const confirmedParts = new Set<number>();
		const targetParts = new Set<number>();
		const putParts: number[] = [];
		const targetUrls = new Map<string, number>();
		let uploadRecord = manifest.uploads.find((item) => item.name === uploadName);
		let assertionFailure: string | undefined;
		let getMeVerified = false;
		const targets = { count: 0 };
		const attach = (targetPage: Page) => {
			targetPage.on('request', (request) => {
				if (request.method() === 'PUT') {
					const partNumber = targetUrls.get(request.url());
					if (partNumber !== undefined) putParts.push(partNumber);
				}
				if (!request.url().startsWith(config.apiUrl) || request.method() !== 'POST') return;
				const method = new URL(request.url()).pathname.split('/').at(-1) ?? '';
				let body: Record<string, unknown>;
				try { body = request.postDataJSON() as Record<string, unknown>; } catch { return; }
				events.push({ method, body, request });
				if (method === 'GetMultipartPartTarget') {
					targets.count++;
					const partNumber = Number(body.partNumber);
					if (Number.isSafeInteger(partNumber)) targetParts.add(partNumber);
				}
				if (method === 'BeginMultipartUpload') {
					const expectedMode = provider === 'R2' ? UploadMode.R2 : UploadMode.RUSTFS;
					const expectedModeName = provider === 'R2' ? 'UPLOAD_MODE_R2' : 'UPLOAD_MODE_RUSTFS';
					const expectedModeShortName = provider;
					const actualMode = String(body.uploadMode);
					if (body.spaceId !== config.spaceId || body.name !== uploadName || ![String(expectedMode), expectedModeName, expectedModeShortName].includes(actualMode)) {
						assertionFailure = 'BeginMultipartUpload did not use the exact isolated space, filename and manual provider mode.';
					}
					uploadRecord = {
						requestId: String(body.requestId ?? ''),
						spaceId: String(body.spaceId ?? ''),
						name: uploadName,
						provider,
						state: 'begin-requested'
					};
					manifest.uploads.push(uploadRecord);
					persistCleanupManifest(config.cleanupManifestPath, manifest);
				}
			});
			targetPage.on('response', async (response) => {
				if (!response.url().startsWith(config.apiUrl)) return;
				const method = new URL(response.url()).pathname.split('/').at(-1) ?? '';
				const event = events.find((item) => item.request === response.request());
				if (!event || response.status() < 200 || response.status() >= 300) return;
				try { event.response = await response.json() as Record<string, unknown>; } catch { return; }
				if (method === 'BeginMultipartUpload' && uploadRecord) {
					const session = event.response.session as Record<string, unknown> | undefined;
					if (session?.id) uploadRecord.uploadId = String(session.id);
					uploadRecord.state = 'open';
					persistCleanupManifest(config.cleanupManifestPath, manifest);
				}
				if (method === 'CompleteMultipartUpload' && uploadRecord) {
					const session = event.response.session as Record<string, unknown> | undefined;
					const entry = (event.response.entry ?? session?.entry) as Record<string, unknown> | undefined;
					if (entry?.id) uploadRecord.entryId = String(entry.id);
					uploadRecord.state = 'completed';
					persistCleanupManifest(config.cleanupManifestPath, manifest);
				}
				if (method === 'GetMe') {
					if (event.response.clerkUserId !== userId) assertionFailure = `The live backend authenticated ${String(event.response.clerkUserId ?? 'no Clerk user ID')} instead of ${userId}.`;
					else getMeVerified = true;
				}
				if (method === 'GetUploadLimits') {
					const multipart = event.response.multipart as Record<string, unknown> | undefined;
					if (!multipart || multipart.enabled !== true || BigInt(String(multipart.maxFileBytes ?? '0')) < BigInt(config.fixtureBytes)) {
						assertionFailure = 'The authenticated account does not advertise multipart capability for the bounded fixture.';
					}
				}
				if (method === 'GetSpaces') {
					const spaces = event.response.spaces as Array<{ id?: string }> | undefined;
					if (!spaces?.some((space) => space.id === config.spaceId)) assertionFailure = `Validated user ${userId} cannot access the configured isolated test space.`;
				}
				if (method === 'GetMultipartPartTarget') {
					const session = event.response.session as Record<string, unknown> | undefined;
					const target = event.response.target as Record<string, unknown> | undefined;
					const part = event.response.part as Record<string, unknown> | undefined;
					const expected = provider === 'R2' ? StorageLocation.R2 : StorageLocation.RUSTFS;
					const expectedName = provider === 'R2' ? 'STORAGE_LOCATION_R2' : 'STORAGE_LOCATION_RUSTFS';
					if (![String(expected), expectedName, provider].includes(String(session?.storageLocation))) assertionFailure = `Backend selected a storage provider other than manual ${provider}.`;
					if (typeof target?.url === 'string' && Number.isSafeInteger(Number(part?.partNumber))) targetUrls.set(target.url, Number(part?.partNumber));
				}
				if (method === 'ConfirmMultipartPart') {
					const part = event.response.part as Record<string, unknown> | undefined;
					const partNumber = Number(part?.partNumber);
					if (Number.isSafeInteger(partNumber) && (part?.state === 3 || part?.state === 'CONFIRMED' || part?.state === 'MULTIPART_PART_STATE_CONFIRMED')) confirmedParts.add(partNumber);
				}
			});
		};
		attach(page);
		return {
			events,
			targets,
			confirmedParts,
			targetParts,
			putParts,
			attach,
			get uploadRecord() { return uploadRecord; },
			hasVerifiedGetMe() { return getMeVerified; },
			assertValid() { if (assertionFailure) throw new Error(assertionFailure); }
		};
	}

	async function selectManualProvider(page: Page, mode: UploadMode): Promise<void> {
		await page.getByRole('link', { name: 'Ustawienia', exact: true }).click();
		const selector = page.getByLabel('Domyślne miejsce przechowywania');
		await expect(selector).toBeVisible();
		await selector.selectOption(String(mode));
		await expect(selector).toHaveValue(String(mode));
		await page.getByRole('link', { name: 'Main', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Pliki wspólne' })).toBeVisible();
	}

	function makeUniqueFixtureLink(name: string, directory: string): { linked: string; wrong: string } {
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		const linked = join(directory, name);
		try {
			linkSync(config.fixturePath, linked);
		} catch {
			throw new Error('The live fixture must be hard-linkable into the isolated temporary profile directory; place it on the same local filesystem.');
		}
	const sourceStat = statSync(linked);
	if (sourceStat.size !== config.fixtureBytes) throw new Error('The linked upload fixture size changed unexpectedly.');
		const wrongDirectory = join(directory, 'wrong');
		mkdirSync(wrongDirectory, { recursive: true, mode: 0o700 });
		const wrong = join(wrongDirectory, name);
	const fixtureFd = openSync(config.fixturePath, 'r');
	const wrongFd = openSync(wrong, 'wx', 0o600);
	try {
		ftruncateSync(wrongFd, config.fixtureBytes);
		const firstByte = Buffer.alloc(1);
		if (readSync(fixtureFd, firstByte, 0, 1, 0) !== 1) throw new Error('Could not read a byte from the live fixture.');
		firstByte[0] = firstByte[0]! ^ 1;
		writeSync(wrongFd, firstByte, 0, 1, 0);
		const sourceStat = statSync(config.fixturePath);
		utimesSync(wrong, sourceStat.atimeMs / 1000, sourceStat.mtimeMs / 1000);
	} finally {
		closeSync(wrongFd);
		closeSync(fixtureFd);
	}
	const wrongStat = statSync(wrong);
	if (wrongStat.size !== config.fixtureBytes || Math.floor(wrongStat.mtimeMs) !== Math.floor(sourceStat.mtimeMs)) {
		throw new Error('The wrong-content control fixture must match the original byte length and modification time.');
	}
		return { linked, wrong };
	}

	async function moveUploadedFileToTrash(page: Page, name: string, uploadRecord: CleanupManifest['uploads'][number]): Promise<void> {
		await page.getByRole('table').getByRole('button', { name: `Przenieś ${name} do kosza` }).click();
		const dialog = page.getByRole('alertdialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Przenieś do kosza' }).click();
		await expect(page.getByText('Element przeniesiono do kosza.')).toBeVisible();
		uploadRecord.state = 'trashed';
		persistCleanupManifest(config.cleanupManifestPath, manifest);
	}

	function uploadTimeoutMs(): number {
		return Number(process.env.E2E_MULTIPART_UPLOAD_TIMEOUT_MS ?? (config.fixtureBytes >= 1_000_000_000 ? 7_200_000 : 120_000));
	}

	async function hashFixtureSha256(path: string): Promise<string> {
		const hash = createHash('sha256');
		for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
		return hash.digest('hex');
	}

	async function verifyDownloadedObject(url: string, sizeBytes: number, entryMd5Base64: string): Promise<{ bytes: number; sha256: string; md5Base64: string }> {
		const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(uploadTimeoutMs()) });
		if (!response.ok || !response.body) {
			await response.body?.cancel();
			throw new Error(`Published object download returned HTTP ${response.status}.`);
		}
		const sha256 = createHash('sha256');
		const md5 = createHash('md5');
		let bytes = 0;
		for await (const chunk of response.body) {
			const buffer = Buffer.from(chunk);
			bytes += buffer.byteLength;
			sha256.update(buffer);
			md5.update(buffer);
		}
		const result = { bytes, sha256: sha256.digest('hex'), md5Base64: md5.digest('base64') };
		if (result.bytes !== sizeBytes) throw new Error(`Published object download returned ${result.bytes} bytes; expected ${sizeBytes}.`);
		if (result.md5Base64 !== entryMd5Base64) throw new Error('Published object MD5 did not match the catalog entry.');
		const expectedSha256 = config.expectedSha256 ?? await hashFixtureSha256(config.fixturePath);
		if (result.sha256 !== expectedSha256) throw new Error('Published object SHA-256 did not match the fixture.');
		return result;
	}

	class BrowserMemorySampler {
		private readonly timer: NodeJS.Timeout;
		private peakRssKiB = 0;
		private samples = 0;
		private sampleError: string | undefined;

		constructor(private readonly ownedProfilePath: string) {
			this.sample();
			this.timer = setInterval(() => this.sample(), 1_000);
		}

		private sample(): void {
			const ps = spawnSync('ps', ['-axo', 'pid=,ppid=,rss=,command='], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
			if (ps.error || ps.status !== 0) {
				this.sampleError = 'Could not sample owned browser RSS using ps.';
				return;
			}
			const processes: Array<{ pid: number; parentPid: number; rssKiB: number; command: string }> = [];
			for (const line of ps.stdout.split('\n')) {
				const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/.exec(line);
				if (match) processes.push({ pid: Number(match[1]), parentPid: Number(match[2]), rssKiB: Number(match[3]), command: match[4]! });
			}
			const ownedPids = new Set(processes.filter((process) => process.command.includes(this.ownedProfilePath)).map((process) => process.pid));
			let expanded = true;
			while (expanded) {
				expanded = false;
				for (const process of processes) {
					if (!ownedPids.has(process.pid) && ownedPids.has(process.parentPid)) {
						ownedPids.add(process.pid);
						expanded = true;
					}
				}
			}
			const rssKiB = processes.reduce((total, process) => total + (ownedPids.has(process.pid) ? process.rssKiB : 0), 0);
			if (rssKiB > 0) {
				this.samples++;
				this.peakRssKiB = Math.max(this.peakRssKiB, rssKiB);
			}
		}

		stop(): number {
			clearInterval(this.timer);
			if (this.samples === 0) throw new Error(this.sampleError ?? 'No browser process referencing the owned profile was measured.');
			return this.peakRssKiB;
		}
	}

	async function authenticatedRpc<T extends Record<string, unknown>>(
		page: Page,
		service: string,
		method: string,
		body: Record<string, unknown>
	): Promise<T> {
		const token = await page.evaluate(async () => {
			const clerk = (window as unknown as { Clerk?: { session?: { getToken(): Promise<string | null> } } }).Clerk;
			return await clerk?.session?.getToken() ?? null;
		});
		if (!token) throw new Error(`Cannot clean up ${service}/${method}: the active browser session has no backend token.`);
		const response = await fetch(`${config.apiUrl}/unisourcecfl.${service}/${method}`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Connect-Protocol-Version': '1'
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(20_000)
		});
		if (!response.ok) {
			let errorCode = '';
			try { errorCode = String((await response.json() as { code?: unknown }).code ?? ''); } catch { /* status is enough */ }
			throw new Error(`${service}/${method} returned HTTP ${response.status}${errorCode ? ` (${errorCode})` : ''}.`);
		}
		return await response.json() as T;
	}

	async function readSavedSession(page: Page, userId: string, name: string): Promise<Record<string, unknown> | undefined> {
		return await page.evaluate(async ({ ownerId, uploadName }) => {
			const request = indexedDB.open('unisource-cloud-multipart-v1', 1);
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction('sessions', 'readonly');
			const range = IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']);
			const records = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
				const get = tx.objectStore('sessions').getAll(range);
				get.onsuccess = () => resolve(get.result as Array<Record<string, unknown>>);
				get.onerror = () => reject(get.error);
			});
			db.close();
			return records.find((record) => record.name === uploadName);
		}, { ownerId: userId, uploadName: name });
	}

	async function listCatalogEntries(page: Page, spaceId = config.spaceId): Promise<Array<{ id: string; name: string; revision: number }>> {
		const entries: Array<{ id: string; name: string; revision: number }> = [];
		let pageToken = '';
		do {
			const result = await authenticatedRpc<{ entries?: Array<{ id: string; name: string; revision: number }>; nextPageToken?: string }>(
				page, 'catalog.v1.CatalogService', 'ListEntries', { spaceId, pageSize: 100, pageToken }
			);
			entries.push(...(result.entries ?? []));
			pageToken = result.nextPageToken ?? '';
		} while (pageToken);
		return entries;
	}

	async function listTrashEntries(page: Page, spaceId = config.spaceId): Promise<Array<{ entry?: { id: string; name: string; revision: number } }>> {
		const items: Array<{ entry?: { id: string; name: string; revision: number } }> = [];
		let pageToken = '';
		do {
			const result = await authenticatedRpc<{ items?: typeof items; nextPageToken?: string }>(
				page, 'catalog.v1.TrashService', 'ListTrash', { spaceId, pageSize: 100, pageToken }
			);
			items.push(...(result.items ?? []));
			pageToken = result.nextPageToken ?? '';
		} while (pageToken);
		return items;
	}

	function multipartState(value: unknown): 'open' | 'completed' | 'cancelled' | 'other' {
		if (value === 1 || value === 'MULTIPART_UPLOAD_STATE_OPEN') return 'open';
		if (value === 4 || value === 'MULTIPART_UPLOAD_STATE_COMPLETED') return 'completed';
		if (value === 5 || value === 'MULTIPART_UPLOAD_STATE_CANCELLED') return 'cancelled';
		return 'other';
	}

	async function fetchMultipartStatus(page: Page, uploadId: string): Promise<{
		session: { state?: number | string; cleanupPending?: boolean };
		parts: Array<{ partNumber: number; state: number | string }>;
	}> {
		const parts: Array<{ partNumber: number; state: number | string }> = [];
		let cursor = 0;
		let session: { state?: number | string; cleanupPending?: boolean } | undefined;
		while (true) {
			const result = await authenticatedRpc<{
				session?: { state?: number | string; cleanupPending?: boolean };
				parts?: Array<{ partNumber: number; state: number | string }>;
				nextPartNumberCursor?: number;
				hasMoreParts?: boolean;
			}>(page, 'upload.v1.MultipartService', 'GetMultipartUpload', {
				uploadId, pageSize: 100, partNumberCursor: cursor
			});
			if (!result.session) throw new Error(`GetMultipartUpload returned no session for ${uploadId}.`);
			session = result.session;
			parts.push(...(result.parts ?? []));
			if (!result.hasMoreParts) break;
			if ((result.nextPartNumberCursor ?? 0) <= cursor) throw new Error('Live multipart status pagination did not advance.');
			cursor = result.nextPartNumberCursor!;
		}
		return { session: session!, parts };
	}

	function confirmedPartNumbers(parts: Array<{ partNumber: number; state: number | string }>): number[] {
		return parts.filter((part) => part.state === 3 || part.state === 'MULTIPART_PART_STATE_CONFIRMED')
			.map((part) => part.partNumber)
			.sort((left, right) => left - right);
	}

	async function cleanupLiveUpload(page: Page, userId: string, upload: CleanupManifest['uploads'][number], downloadUrl?: string): Promise<void> {
		if (!upload.uploadId) {
			const saved = await readSavedSession(page, userId, upload.name);
			if (!saved) throw new Error(`No persisted multipart session was available to reconcile ${upload.name}.`);
			const begin = await authenticatedRpc<{ session?: { id?: string; state?: number; revision?: string | number } }>(
				page, 'upload.v1.MultipartService', 'BeginMultipartUpload', {
					spaceId: saved.spaceId,
					...(saved.parentId ? { parentId: saved.parentId } : {}),
					name: saved.name,
					sizeBytes: String(saved.sizeBytes),
					manifestFingerprintHex: saved.fingerprintHex,
					manifestParts: (saved.parts as Array<{ partNumber: number; sizeBytes: number; sha256Hex: string }>).map((part) => ({
						partNumber: part.partNumber, sizeBytes: String(part.sizeBytes), sha256Hex: part.sha256Hex
					})),
					uploadMode: saved.uploadMode,
					requestId: saved.requestId
				}
			);
			if (!begin.session?.id) throw new Error(`Begin replay returned no session while cleaning up ${upload.name}.`);
			upload.uploadId = begin.session.id;
			persistCleanupManifest(config.cleanupManifestPath, manifest);
		}

		let remote = await authenticatedRpc<{ session?: { id: string; spaceId: string; state: number; revision: string | number } }>(
			page, 'upload.v1.MultipartService', 'GetMultipartUpload', { uploadId: upload.uploadId, pageSize: 1, partNumberCursor: 0 }
		);
		if (!remote.session) throw new Error(`GetMultipartUpload returned no session for ${upload.uploadId}.`);
		const spaceId = remote.session.spaceId || upload.spaceId || config.spaceId;
		upload.spaceId = spaceId;
		if (multipartState(remote.session.state) === 'open') {
			remote = await authenticatedRpc<{ session?: { id: string; spaceId: string; state: number; revision: string | number } }>(
				page, 'upload.v1.MultipartService', 'CancelMultipartUpload', {
					uploadId: upload.uploadId,
					expectedRevision: String(remote.session.revision),
					requestId: crypto.randomUUID()
				}
			);
		}
		const state = multipartState(remote.session?.state);
		if (state !== 'cancelled' && state !== 'completed') {
			throw new Error(`Multipart session ${upload.uploadId} remained in state ${String(remote.session?.state ?? 'unknown')} during cleanup.`);
		}
		if (state === 'cancelled') {
			upload.state = 'cancelled';
			persistCleanupManifest(config.cleanupManifestPath, manifest);
			return;
		}

		let activeEntries = await listCatalogEntries(page, spaceId);
		let trashItems = await listTrashEntries(page, spaceId);
		let activeEntry = activeEntries.find((entry) => entry.id === upload.entryId || entry.name === upload.name);
		let trashItem = trashItems.find((item) => item.entry?.id === upload.entryId || item.entry?.name === upload.name);
		if (!activeEntry && !trashItem) {
			// A completed upload can be briefly absent from ListEntries while its catalog
			// transaction settles; poll by the run-unique name even if the RPC observer
			// did not capture the entry ID from its response.
			await expect.poll(async () => {
				activeEntries = await listCatalogEntries(page, spaceId);
				trashItems = await listTrashEntries(page, spaceId);
				activeEntry = activeEntries.find((entry) => entry.id === upload.entryId || entry.name === upload.name);
				trashItem = trashItems.find((item) => item.entry?.id === upload.entryId || item.entry?.name === upload.name);
				return Boolean(activeEntry || trashItem);
			}, { timeout: 30_000 }).toBe(true);
		}
		const entryId = activeEntry?.id ?? trashItem?.entry?.id ?? upload.entryId;
		if (!entryId) throw new Error(`Completed upload ${upload.name} has no catalog entry ID to clean up.`);
		upload.entryId = entryId;
		if (activeEntry) {
			const trashed = await authenticatedRpc<{ item?: { entry?: { id: string; name: string; revision: number } } }>(
				page, 'catalog.v1.TrashService', 'TrashEntry', {
					spaceId, entryId, expectedRevision: activeEntry.revision
				}
			);
			trashItem = trashed.item;
		}
		const trashedEntry = trashItem?.entry;
		if (!trashedEntry) throw new Error(`Catalog entry ${entryId} was not available in trash for permanent cleanup.`);
		if (!downloadUrl) {
			try {
				const download = await authenticatedRpc<{ url?: string }>(
					page, 'catalog.v1.CatalogService', 'GetDownload', { spaceId, entryId }
				);
				if (typeof download.url === 'string') downloadUrl = download.url;
			} catch (error) {
				if (!(error instanceof Error) || !/GetDownload returned HTTP 404/.test(error.message)) throw error;
			}
		}
		const deleted = await authenticatedRpc<{ accepted?: boolean }>(
			page, 'catalog.v1.TrashService', 'DeletePermanently', {
				spaceId, entryId, expectedRevision: trashedEntry.revision
			}
		);
		if (deleted.accepted !== true) throw new Error(`Permanent deletion was not accepted for catalog entry ${entryId}.`);
		await expect.poll(async () => {
			const latest = await authenticatedRpc<{ session?: { cleanupPending?: boolean } }>(
				page, 'upload.v1.MultipartService', 'GetMultipartUpload', { uploadId: upload.uploadId, pageSize: 1, partNumberCursor: 0 }
			);
			// Protobuf JSON may omit an explicitly false proto3 boolean. Treat an
			// existing session with no pending flag as false; only true means work remains.
			return latest.session !== undefined && latest.session.cleanupPending !== true;
		}, { timeout: 120_000 }).toBe(true);
		if (downloadUrl) {
			const objectResponse = await fetch(downloadUrl, { method: 'GET', signal: AbortSignal.timeout(20_000) });
			await objectResponse.body?.cancel();
			if (objectResponse.status !== 404) throw new Error(`Deleted object returned HTTP ${objectResponse.status} from its signed download URL.`);
		}
		activeEntries = await listCatalogEntries(page, spaceId);
		trashItems = await listTrashEntries(page, spaceId);
		if (activeEntries.some((entry) => entry.id === entryId) || trashItems.some((item) => item.entry?.id === entryId)) {
			throw new Error(`Catalog entry ${entryId} remained visible after permanent deletion.`);
		}
		upload.state = 'deleted-and-verified';
		persistCleanupManifest(config.cleanupManifestPath, manifest);
	}

	async function runProviderUpload(provider: 'R2' | 'RustFS', userId: string, restartDuringDataPlane: boolean): Promise<void> {
		const profileRoot = mkdtempSync(join(tmpdir(), `unisource-live-multipart-${provider.toLowerCase()}-`));
		const profilePath = join(profileRoot, 'browser-profile');
		const filename = `e2e-multipart-${provider.toLowerCase()}-${manifest.runId}.bin`;
		const { linked: fixture, wrong } = await makeUniqueFixtureLink(filename, join(profileRoot, 'fixtures'));
		let context: BrowserContext | undefined;
		let page: Page | undefined;
		let observer: ReturnType<typeof observeRpc> | undefined;
		let memorySampler: BrowserMemorySampler | undefined;
		let laterPartTargetReached!: () => void;
		let releaseLaterPartTargets!: () => void;
		const laterPartTargetHeld = new Promise<void>((resolve) => { laterPartTargetReached = resolve; });
		const laterPartTargetGate = new Promise<void>((resolve) => { releaseLaterPartTargets = resolve; });
		let uploaded: CleanupManifest['uploads'][number] | undefined;
		let downloadUrl: string | undefined;
		try {
			({ context, page } = await launchProfile(profilePath));
			if (config.fixtureBytes >= 1_000_000_000) memorySampler = new BrowserMemorySampler(profilePath);
			if (restartDuringDataPlane) {
				await page.route(`${config.apiUrl}/**/GetMultipartPartTarget`, async (route) => {
					let body: Record<string, unknown>;
					try { body = route.request().postDataJSON() as Record<string, unknown>; } catch { return route.continue(); }
					if (Number(body.partNumber) < 3) return route.continue();
					laterPartTargetReached();
					await laterPartTargetGate;
					await route.abort('aborted').catch(() => {});
				});
			}
			observer = observeRpc(page, userId, filename, provider);
			await attachSignIn(page, userId);
			await expect.poll(() => observer!.hasVerifiedGetMe(), { timeout: 30_000 }).toBe(true);
			observer.assertValid();
			await page.getByRole('link', { name: 'Main', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Pliki wspólne' })).toBeVisible();
			await selectManualProvider(page, provider === 'R2' ? UploadMode.R2 : UploadMode.RUSTFS);
			await expect(page.getByLabel('Wybierz pliki do przesłania')).toBeEnabled();
			await page.getByLabel('Wybierz pliki do przesłania').setInputFiles(fixture);
			if (restartDuringDataPlane) {
				await laterPartTargetHeld;
				uploaded = observer.uploadRecord;
				if (!uploaded) throw new Error('The live upload did not persist its BeginMultipartUpload record.');
				let confirmedBeforeRestart = new Set<number>();
				await expect.poll(async () => {
					const status = await fetchMultipartStatus(page!, uploaded!.uploadId!);
					const confirmed = confirmedPartNumbers(status.parts);
					confirmedBeforeRestart = new Set(confirmed);
					return confirmed;
				}, { timeout: 120_000 }).toEqual([1, 2]);
				if (confirmedBeforeRestart.size >= 4) throw new Error('Later part targets were held after every fixture part was already confirmed.');
				await page.getByRole('button', { name: 'Wstrzymaj' }).click();
				await expect(page.getByRole('status')).toContainText('Wstrzymano');
				releaseLaterPartTargets();
				await expect.poll(async () => page!.evaluate(async (ownerId) => {
					const request = indexedDB.open('unisource-cloud-multipart-v1', 1);
					const db = await new Promise<IDBDatabase>((resolve, reject) => {
						request.onsuccess = () => resolve(request.result);
						request.onerror = () => reject(request.error);
					});
					const range = IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff']);
					const tx = db.transaction('sessions', 'readonly');
					const items = await new Promise<Array<{ phase: string; uploadId?: string }>>((resolve, reject) => {
						const get = tx.objectStore('sessions').getAll(range);
						get.onsuccess = () => resolve(get.result);
						get.onerror = () => reject(get.error);
					});
					db.close();
					return items.find((item) => item.uploadId)?.phase;
				}, userId)).toBe('paused');
				await context.close();
				context = undefined;
				const gatewayRestartHook = process.env.E2E_MULTIPART_GATEWAY_RESTART_HOOK?.trim();
				if (gatewayRestartHook) {
					if (provider !== 'R2') {
						throw new Error('The local gateway restart hook is reserved for R2 restart acceptance.');
					}
					const hookPath = resolve(gatewayRestartHook);
					if (!existsSync(hookPath)) throw new Error('Configured local multipart gateway restart hook does not exist.');
					try {
						execFileSync(process.execPath, ['--import', 'tsx', hookPath, uploaded.uploadId!], {
							cwd: dirname(dirname(hookPath)),
							stdio: 'pipe',
							timeout: 30_000,
							env: { ...process.env }
						});
						uploaded.gatewayRestarted = true;
						persistCleanupManifest(config.cleanupManifestPath, manifest);
					} catch {
						throw new Error('The guarded local multipart gateway restart hook failed; inspect its isolated run log.');
					}
				}
				({ context, page } = await launchProfile(profilePath));
				observer.attach(page);
				await page.goto(config.baseUrl);
				await expect(page.getByRole('heading', { name: 'Moje pliki' })).toBeVisible();
				await page.getByRole('link', { name: 'Main', exact: true }).click();
				await expect(page.getByRole('heading', { name: 'Pliki wspólne' })).toBeVisible();
				const resumeInput = page.getByLabel(`Wybierz plik do wznowienia: ${filename}`);
				await expect(resumeInput).toBeVisible();
				const targetsBeforeMismatch = observer.targets.count;
				await resumeInput.setInputFiles(wrong);
				await expect(page.getByRole('alert')).toContainText('nie odpowiada zapisanej sesji', {
					timeout: Math.min(uploadTimeoutMs(), 30_000)
				});
				expect(observer.targets.count).toBe(targetsBeforeMismatch);
				const targetRequestsBeforeResume = observer.events.filter((event) => event.method === 'GetMultipartPartTarget').length;
				const putsBeforeResume = observer.putParts.length;
				await page.getByLabel(`Wybierz plik do wznowienia: ${filename}`).setInputFiles(fixture);
				await expect(page.getByRole('status')).toContainText('Przesłano', { timeout: uploadTimeoutMs() });
				expect(observer.targets.count).toBeGreaterThan(targetsBeforeMismatch);
				const resumedTargets = observer.events.filter((event) => event.method === 'GetMultipartPartTarget').slice(targetRequestsBeforeResume);
				for (const event of resumedTargets) expect(confirmedBeforeRestart.has(Number(event.body.partNumber))).toBe(false);
				const resumedPuts = observer.putParts.slice(putsBeforeResume);
				for (const partNumber of resumedPuts) expect(confirmedBeforeRestart.has(partNumber)).toBe(false);
				await expect.poll(async () => {
					const status = await fetchMultipartStatus(page!, uploaded!.uploadId!);
					return multipartState(status.session.state) === 'completed' ? confirmedPartNumbers(status.parts) : [];
				}, { timeout: uploadTimeoutMs() }).toEqual(
					Array.from({ length: Math.ceil(config.fixtureBytes / MULTIPART_PART_BYTES) }, (_, index) => index + 1)
				);
			} else {
				await expect(page.getByRole('status')).toContainText('Przesłano', { timeout: uploadTimeoutMs() });
				uploaded = observer.uploadRecord;
			}
				observer.assertValid();
				if (!uploaded) throw new Error('The live upload did not produce a cleanup record.');
			await expect(page.getByRole('table').getByText(filename, { exact: true })).toBeVisible();
			if (uploaded.uploadId) {
			const latest = await authenticatedRpc<{ session?: { spaceId?: string; entry?: { id?: string } } }>(
					page, 'upload.v1.MultipartService', 'GetMultipartUpload', { uploadId: uploaded.uploadId, pageSize: 1, partNumberCursor: 0 }
				);
				uploaded.spaceId = latest.session?.spaceId ?? uploaded.spaceId;
				uploaded.entryId = latest.session?.entry?.id ?? uploaded.entryId;
			}
			if (!uploaded.entryId) throw new Error('The completed multipart session did not expose its catalog entry ID.');
			const catalogEntry = await authenticatedRpc<{ entry?: { sizeBytes?: string; md5Base64?: string } }>(
				page, 'catalog.v1.CatalogService', 'GetEntry', { spaceId: uploaded.spaceId ?? config.spaceId, entryId: uploaded.entryId }
			);
			if (!catalogEntry.entry?.md5Base64) throw new Error('The catalog entry did not expose its committed MD5 digest.');
			if (catalogEntry.entry.sizeBytes !== undefined && BigInt(catalogEntry.entry.sizeBytes) !== BigInt(config.fixtureBytes)) {
				throw new Error(`Catalog entry size ${catalogEntry.entry.sizeBytes} did not match fixture size ${config.fixtureBytes}.`);
			}
			const download = await authenticatedRpc<{ url?: string }>(
				page, 'catalog.v1.CatalogService', 'GetDownload', { spaceId: uploaded.spaceId ?? config.spaceId, entryId: uploaded.entryId }
			);
			if (typeof download.url === 'string') downloadUrl = download.url;
			if (!downloadUrl) throw new Error('GetDownload returned no URL for streaming integrity verification.');
			const verification = await verifyDownloadedObject(downloadUrl, config.fixtureBytes, catalogEntry.entry.md5Base64);
			uploaded.verifiedBytes = verification.bytes;
			uploaded.sha256 = verification.sha256;
			uploaded.md5Base64 = verification.md5Base64;
			persistCleanupManifest(config.cleanupManifestPath, manifest);
			await moveUploadedFileToTrash(page, filename, uploaded);
		} finally {
			releaseLaterPartTargets?.();
			const upload = observer?.uploadRecord;
			if (page && upload) {
				try {
					await cleanupLiveUpload(page, userId, upload, downloadUrl);
				} catch (error) {
					manifest.cleanupErrors.push(`Upload cleanup ${upload.uploadId ?? upload.requestId}: ${error instanceof Error ? error.message : 'cleanup failed'}`);
					persistCleanupManifest(config.cleanupManifestPath, manifest);
				}
			}
			await context?.close().catch(() => {});
			if (memorySampler) {
				try {
					const peakRssKiB = memorySampler.stop();
					if (observer?.uploadRecord) {
						observer.uploadRecord.browserPeakRssKiB = peakRssKiB;
						persistCleanupManifest(config.cleanupManifestPath, manifest);
					}
				} catch (error) {
					manifest.cleanupErrors.push(`Browser memory sampling: ${error instanceof Error ? error.message : 'sampling failed'}`);
					persistCleanupManifest(config.cleanupManifestPath, manifest);
				}
			}
			rmSync(profileRoot, { recursive: true, force: true });
		}
	}

	test('manual R2 resumes only unconfirmed parts after a real browser restart and rejects a different file', async ({ browserName }) => {
		test.skip(browserName !== 'chromium', 'Live data-plane acceptance runs once in isolated Chromium.');
		await runProviderUpload('R2', config.userAId, true);
	});

	test('manual RustFS upload completes through the live gateway and backend API', async ({ browserName }) => {
		test.skip(browserName !== 'chromium', 'Live data-plane acceptance runs once in isolated Chromium.');
		await runProviderUpload('RustFS', config.userBId, false);
	});
});
