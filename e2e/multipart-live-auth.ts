import { chmodSync, existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export type LiveMultipartConfig = {
	baseUrl: string;
	apiUrl: string;
	clerkSecretKey: string;
	clerkPublishableKey: string;
	userAId: string;
	userBId: string;
	spaceId: string;
	fixturePath: string;
	fixtureBytes: number;
	expectedSha256?: string;
	cleanupManifestPath: string;
};

export type CleanupManifest = {
	format: 1;
	runId: string;
	createdAt: string;
	status: 'running' | 'complete' | 'failed';
	testOutcome: 'running' | 'passed' | 'failed' | 'interrupted';
	cleanupStatus: 'pending' | 'complete' | 'failed';
	users: string[];
	tickets: Array<{ id: string; userId: string; status: 'pending' | 'consumed' | 'revoked' }>;
	sessions: Array<{ id: string; userId: string; status: 'active' | 'revoked' | 'unknown' }>;
	uploads: Array<{
		requestId: string;
		uploadId?: string;
		entryId?: string;
		spaceId?: string;
		name: string;
		provider: 'R2' | 'RustFS';
		state: string;
		verifiedBytes?: number;
		sha256?: string;
		md5Base64?: string;
		browserPeakRssKiB?: number;
		gatewayRestarted?: boolean;
	}>;
	cleanupErrors: string[];
};

const CLERK_API = 'https://api.clerk.com/v1';

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required live multipart variable ${name}.`);
	return value;
}

function assertLocalOrigin(value: string, name: string, port: string): void {
	const url = new URL(value);
	if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.port !== port || url.username || url.password) {
		throw new Error(`${name} must point to the isolated localhost:${port} environment.`);
	}
}

export function loadLiveMultipartConfig(): LiveMultipartConfig {
	const baseUrl = new URL(required('E2E_BASE_URL')).origin;
	const apiUrl = new URL(required('PUBLIC_CLOUD_API_URL')).origin;
	assertLocalOrigin(baseUrl, 'E2E_BASE_URL', process.env.E2E_FRONTEND_PORT ?? '3000');
	assertLocalOrigin(apiUrl, 'PUBLIC_CLOUD_API_URL', '8787');
	const clerkSecretKey = required('CLERK_SECRET_KEY');
	const clerkPublishableKey = required('PUBLIC_CLERK_PUBLISHABLE_KEY');
	if (!clerkSecretKey.startsWith('sk_test_')) throw new Error('Live multipart acceptance requires a Clerk development secret key (sk_test_).');
	if (!clerkPublishableKey.startsWith('pk_test_')) throw new Error('Live multipart acceptance requires a Clerk development publishable key (pk_test_).');
	const userAId = required('E2E_CLERK_USER_A_ID');
	const userBId = required('E2E_CLERK_USER_B_ID');
	if (!/^user_[A-Za-z0-9]+$/.test(userAId) || !/^user_[A-Za-z0-9]+$/.test(userBId) || userAId === userBId) {
		throw new Error('E2E_CLERK_USER_A_ID and E2E_CLERK_USER_B_ID must be different exact Clerk user IDs.');
	}
	const fixturePath = resolve(required('E2E_MULTIPART_FIXTURE_PATH'));
	const fixtureBytes = Number(required('E2E_MULTIPART_FIXTURE_BYTES'));
	if (!Number.isSafeInteger(fixtureBytes) || fixtureBytes <= 100_000_000) {
		throw new Error('E2E_MULTIPART_FIXTURE_BYTES must be a bounded value over 100,000,000 bytes.');
	}
	const expectedSha256 = process.env.E2E_MULTIPART_EXPECTED_SHA256?.trim().toLowerCase();
	if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
		throw new Error('E2E_MULTIPART_EXPECTED_SHA256 must be a 64-character SHA-256 hex digest.');
	}
	if (fixtureBytes === 10_000_000_000 && (process.env.E2E_MULTIPART_10GB_APPROVED !== '1' || !expectedSha256)) {
		throw new Error('A 10 GB live upload requires E2E_MULTIPART_10GB_APPROVED=1 and its expected SHA-256.');
	}
	const cleanupManifestPath = resolve(process.env.E2E_MULTIPART_CLEANUP_MANIFEST ?? `.cache/live-multipart-${randomUUID()}.json`);
	return {
		baseUrl,
		apiUrl,
		clerkSecretKey,
		clerkPublishableKey,
		userAId,
		userBId,
		spaceId: required('E2E_MULTIPART_SPACE_ID'),
		fixturePath,
		fixtureBytes,
		expectedSha256,
		cleanupManifestPath
	};
}

async function clerkRequest<T>(secret: string, path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${CLERK_API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${secret}`,
			Accept: 'application/json',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers
		},
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`Clerk development API request ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}.`);
	return await response.json() as T;
}

export async function validateDedicatedUsers(config: LiveMultipartConfig): Promise<void> {
	for (const userId of [config.userAId, config.userBId]) {
		const user = await clerkRequest<{ id?: string; deleted?: boolean }>(config.clerkSecretKey, `/users/${encodeURIComponent(userId)}`);
		if (user.id !== userId || user.deleted) throw new Error(`Clerk user ID validation failed for the configured test user ${userId}.`);
	}
}

export function createCleanupManifest(config: LiveMultipartConfig): CleanupManifest {
	const manifest: CleanupManifest = {
		format: 1,
		runId: randomUUID(),
		createdAt: new Date().toISOString(),
		status: 'running',
		testOutcome: 'running',
		cleanupStatus: 'pending',
		users: [config.userAId, config.userBId],
		tickets: [],
		sessions: [],
		uploads: [],
		cleanupErrors: []
	};
	const directory = dirname(config.cleanupManifestPath);
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	if (existsSync(config.cleanupManifestPath)) throw new Error('Cleanup manifest already exists; choose a new E2E_MULTIPART_CLEANUP_MANIFEST path.');
	writeFileSync(config.cleanupManifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
	chmodSync(config.cleanupManifestPath, 0o600);
	return manifest;
}

export function persistCleanupManifest(path: string, manifest: CleanupManifest): void {
	const temporaryPath = `${path}.${process.pid}.tmp`;
	writeFileSync(temporaryPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });
	chmodSync(temporaryPath, 0o600);
	renameSync(temporaryPath, path);
}

export async function createSignInTicket(config: LiveMultipartConfig, manifest: CleanupManifest, userId: string): Promise<{ id: string; token: string }> {
	if (userId !== config.userAId && userId !== config.userBId) throw new Error('Refusing to issue a Clerk ticket for an unvalidated user ID.');
	const ticket = await clerkRequest<{ id: string; token: string; user_id: string; status: string }>(config.clerkSecretKey, '/sign_in_tokens', {
		method: 'POST',
		body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 })
	});
	if (!ticket.id || !ticket.token || ticket.user_id !== userId) throw new Error('Clerk returned a sign-in ticket for an unexpected user.');
	manifest.tickets.push({ id: ticket.id, userId, status: 'pending' });
	persistCleanupManifest(config.cleanupManifestPath, manifest);
	return { id: ticket.id, token: ticket.token };
}

export async function reconcileClerkSessions(config: LiveMultipartConfig, manifest: CleanupManifest): Promise<void> {
	const runStartSeconds = Math.floor(Date.parse(manifest.createdAt) / 1000) - 10;
	const runEndSeconds = Math.floor(Date.now() / 1000) + 10;
	for (const userId of manifest.users) {
		if (userId !== config.userAId && userId !== config.userBId) continue;
		let offset = 0;
		while (true) {
			const query = new URLSearchParams({ user_id: userId, limit: '100', offset: String(offset), order_by: '-created_at' });
			const response = await clerkRequest<{ data?: Array<{ id?: string; user_id?: string; status?: string; created_at?: number }>; total_count?: number }>(
				config.clerkSecretKey,
				`/sessions?${query.toString()}`
			);
			const sessions = response.data ?? [];
			for (const session of sessions) {
				if (!session.id || session.user_id !== userId || !Number.isFinite(session.created_at) ||
					session.created_at! < runStartSeconds || session.created_at! > runEndSeconds) continue;
				const status = session.status === 'active' ? 'active' : session.status === 'revoked' ? 'revoked' : 'unknown';
				const existing = manifest.sessions.find((record) => record.id === session.id);
				if (existing) {
					if (existing.userId !== userId) throw new Error('A reconciled Clerk session belongs to a different test user.');
					existing.status = status;
				} else {
					manifest.sessions.push({ id: session.id, userId, status });
				}
			}
			persistCleanupManifest(config.cleanupManifestPath, manifest);
			if (sessions.length < 100 || sessions.every((session) => Number.isFinite(session.created_at) && session.created_at! < runStartSeconds)) break;
			offset += sessions.length;
		}
	}
}

export async function revokeClerkArtifacts(config: LiveMultipartConfig, manifest: CleanupManifest): Promise<void> {
	for (const ticket of manifest.tickets) {
		if (ticket.status !== 'pending') continue;
		try {
			await clerkRequest(config.clerkSecretKey, `/sign_in_tokens/${encodeURIComponent(ticket.id)}/revoke`, { method: 'POST', body: JSON.stringify({}) });
			ticket.status = 'revoked';
		} catch (error) {
			manifest.cleanupErrors.push(`Ticket ${ticket.id}: ${error instanceof Error ? error.message : 'revocation failed'}`);
		}
	}
	for (const session of manifest.sessions) {
		if (session.status !== 'active') continue;
		try {
			await clerkRequest(config.clerkSecretKey, `/sessions/${encodeURIComponent(session.id)}/revoke`, { method: 'POST', body: JSON.stringify({}) });
			session.status = 'revoked';
		} catch (error) {
			manifest.cleanupErrors.push(`Session ${session.id}: ${error instanceof Error ? error.message : 'revocation failed'}`);
		}
	}
	persistCleanupManifest(config.cleanupManifestPath, manifest);
}
