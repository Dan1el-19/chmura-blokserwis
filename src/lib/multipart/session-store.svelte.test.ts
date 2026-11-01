import { expect, it } from 'vitest';
import { UploadMode } from '../gen/unisourcecfl/upload/v1/upload_pb.js';
import { IndexedDbMultipartSessionStore, type PersistedMultipartSession } from './session-store.js';

function session(ownerId: string, localId: string): PersistedMultipartSession {
	return {
		ownerId,
		localId,
		requestId: `request-${localId}`,
		uploadId: `upload-${localId}`,
		spaceId: 'personal',
		parentId: 'folder-1',
		name: 'archive.bin',
		sizeBytes: 100_000_001,
		partSizeBytes: 33_554_432,
		fingerprintHex: 'a'.repeat(64),
		parts: [{
			partNumber: 1, sizeBytes: 100_000_001, sha256Hex: 'b'.repeat(64), md5Base64: 'md5',
			targetOperation: { attemptId: 'attempt-1', requestId: 'target-request-1', expectedRevision: 1n, operationId: 'target-request-1', generation: 1n }
		}],
		uploadMode: UploadMode.AUTO,
		attemptId: 'attempt-1',
		attemptNumber: 1,
		revision: 1n,
		expiresAtEpochMs: 2_000_000_000_000,
		phase: 'uploading'
	};
}

it('persists recoverable metadata by owner and omits secrets and file contents', async () => {
	const databaseName = `multipart-test-${crypto.randomUUID()}`;
	const store = new IndexedDbMultipartSessionStore(databaseName);
	try {
		const untrusted = {
			...session('alice', 'local-1'),
			accessToken: 'never-store-me',
			targetUrl: 'https://signed.example/secret',
			file: new File(['secret file bytes'], 'archive.bin')
		};
		await store.put(untrusted as unknown as PersistedMultipartSession);
		const saved = await store.get('alice', 'local-1');

		expect(saved).toMatchObject({
			ownerId: 'alice',
			localId: 'local-1',
			uploadId: 'upload-local-1',
			fingerprintHex: 'a'.repeat(64),
			parts: [{ partNumber: 1, sizeBytes: 100_000_001, sha256Hex: 'b'.repeat(64), md5Base64: 'md5', targetOperation: { attemptId: 'attempt-1', requestId: 'target-request-1', expectedRevision: 1n, operationId: 'target-request-1', generation: 1n } }]
		});
		expect(Object.keys(saved ?? {})).not.toContain('accessToken');
		expect(Object.keys(saved ?? {})).not.toContain('targetUrl');
		expect(Object.keys(saved ?? {})).not.toContain('file');
	} finally {
		store.close();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(databaseName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'));
		});
	}
});

it('isolates the same local session id across accounts and only deletes the selected owner record', async () => {
	const databaseName = `multipart-test-${crypto.randomUUID()}`;
	const store = new IndexedDbMultipartSessionStore(databaseName);
	try {
		await store.put(session('alice', 'shared-local-id'));
		await store.put(session('bob', 'shared-local-id'));

		expect((await store.list('alice')).map((record) => record.ownerId)).toEqual(['alice']);
		expect(await store.get('charlie', 'shared-local-id')).toBeUndefined();
		await store.delete('alice', 'shared-local-id');
		expect(await store.get('alice', 'shared-local-id')).toBeUndefined();
		expect(await store.get('bob', 'shared-local-id')).toMatchObject({ ownerId: 'bob' });
	} finally {
		store.close();
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(databaseName);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
			request.onblocked = () => reject(new Error('IndexedDB cleanup was blocked.'));
		});
	}
});
