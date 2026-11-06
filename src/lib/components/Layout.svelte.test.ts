import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LayoutTestShell from './LayoutTestShell.svelte';

const fixture = vi.hoisted(() => ({
	listener: () => {},
	getToken: vi.fn(),
	clerk: {
		user: { id: 'alice' },
		session: { id: 'session-alice', status: 'active', getToken: vi.fn() },
		load: vi.fn(),
		addListener: vi.fn()
	},
	getMe: vi.fn(),
	getSpaces: vi.fn(),
	getUploadLimits: vi.fn(),
	multipartUploads: {},
	listEntries: vi.fn(),
	createUpload: vi.fn(),
	completeUpload: vi.fn(),
	cancelUpload: vi.fn(),
	uploadToTarget: vi.fn()
}));
vi.mock('$app/env/public', () => ({
	PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture',
	PUBLIC_CLOUD_API_URL: 'http://localhost:8787',
	PUBLIC_QUOTES_API_URL: ''
}));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('#lib/clerk-ui.js', () => ({ loadClerk: async () => fixture.clerk }));
vi.mock('#lib/api.js', () => ({
	setSessionTokenProvider: vi.fn(),
	identity: { getMe: fixture.getMe },
	catalog: { getSpaces: fixture.getSpaces, listEntries: fixture.listEntries },
	storageSettings: { getUploadLimits: fixture.getUploadLimits },
	shareLinks: {},
	multipartUploads: fixture.multipartUploads,
	trash: {},
	uploads: {
		createUpload: fixture.createUpload,
		completeUpload: fixture.completeUpload,
		cancelUpload: fixture.cancelUpload
	}
}));
vi.mock('#lib/upload.js', async (original) => ({
	...(await original<typeof import('#lib/upload.js')>()),
	calculateMd5Base64: vi.fn().mockResolvedValue('md5'),
	uploadToTarget: fixture.uploadToTarget
}));
beforeEach(() => {
	vi.resetAllMocks();
	fixture.clerk.user = { id: 'alice' };
	fixture.clerk.session = { id: 'session-alice', status: 'active', getToken: fixture.getToken };
	fixture.getToken.mockResolvedValue('alice-token');
	fixture.clerk.addListener.mockImplementation((listener) => {
		fixture.listener = listener;
		return () => {};
	});
	fixture.getMe.mockResolvedValue({});
	fixture.getSpaces.mockResolvedValue({ spaces: [{ id: 'personal', kind: 2 }] });
	fixture.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false });
	fixture.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	fixture.createUpload.mockResolvedValue({
		session: { id: 'upload-alice', state: 1, attemptId: 'attempt-1', storageLocation: 1 },
		target: { url: 'https://upload.example', headers: {} }
	});
	fixture.cancelUpload.mockResolvedValue({});
	fixture.completeUpload.mockResolvedValue({});
});
it('aborts the old session queue immediately while a new Clerk token is still being verified', async () => {
	let finishPut!: () => void;
	fixture.uploadToTarget.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishPut = resolve;
			})
	);
	const screen = await render(LayoutTestShell);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload([new File(['a'], 'alice-one'), new File(['b'], 'alice-two')]);
	await expect.poll(() => fixture.uploadToTarget).toHaveBeenCalledTimes(1);
	const signal = fixture.uploadToTarget.mock.calls[0][3].signal as AbortSignal;
	fixture.clerk.user = { id: 'bob' };
	fixture.clerk.session = {
		id: 'session-bob',
		status: 'active',
		getToken: vi.fn(() => new Promise<string>(() => {}))
	};
	fixture.listener();
	expect(signal.aborted).toBe(true);
	finishPut();
	await expect.element(screen.getByText('Łączenie z bezpiecznym kontem…')).toBeVisible();
	expect(fixture.createUpload).toHaveBeenCalledTimes(1);
});
it('keeps the current page and transfer when Clerk repeats the same active session', async () => {
	let finishPut!: () => void;
	fixture.uploadToTarget.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishPut = resolve;
			})
	);
	const screen = await render(LayoutTestShell);
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['a'], 'alice-one'));
	await expect.poll(() => fixture.uploadToTarget).toHaveBeenCalledTimes(1);
	const signal = fixture.uploadToTarget.mock.calls[0][3].signal as AbortSignal;
	fixture.listener();
	expect(signal.aborted).toBe(false);
	await expect.element(screen.getByRole('region', { name: 'Transfery' })).toBeVisible();
	expect(fixture.getMe).toHaveBeenCalledTimes(1);
	finishPut();
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
});
