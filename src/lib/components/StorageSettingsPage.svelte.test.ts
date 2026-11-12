import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Code, ConnectError } from '@connectrpc/connect';
import StorageSettingsPage from './SettingsTestShell.svelte';

const api = vi.hoisted(() => ({
	getStorageSettings: vi.fn(),
	updateStorageSettings: vi.fn(),
	getUploadLimits: vi.fn()
}));
vi.mock('#lib/api.js', () => ({
	storageSettings: api,
	catalog: {},
	identity: {},
	trash: {},
	multipartUploads: {},
	uploads: {}
}));

const initialSettings = {
	revision: 3n,
	maxUploadBytes: 25_000_000n,
	r2LimitBytes: 100_000_000_000n,
	rustfsLimitBytes: 1_500_000_000n,
	r2MaxCapacityBytes: 100_000_000_000n,
	rustfsMaxCapacityBytes: 10_000_000_000n,
	r2UsedBytes: 10_000_000_000n,
	rustfsUsedBytes: 500_000_000n
};

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 25_000_000n, canManage: true });
	api.getStorageSettings.mockResolvedValue({ settings: { ...initialSettings } });
	api.updateStorageSettings.mockResolvedValue({ settings: { ...initialSettings, revision: 4n } });
});

it('shows an access denied state when the backend denies settings access', async () => {
	api.getStorageSettings.mockRejectedValue(new ConnectError('Forbidden', Code.PermissionDenied));
	const screen = await render(StorageSettingsPage);
	await expect.element(screen.getByRole('alert')).toHaveTextContent(/brak uprawnień/i);
	expect(api.updateStorageSettings).not.toHaveBeenCalled();
});

it('converts decimal form values to bytes and sends the current revision', async () => {
	const screen = await render(StorageSettingsPage);
	await expect.element(screen.getByRole('heading', { name: 'Ustawienia magazynu' })).toBeVisible();
	await expect
		.element(
			screen.getByText(
				/Użycie obejmuje pliki, rezerwacje oraz dane oczekujące na bezpieczne zwolnienie/i
			)
		)
		.toBeVisible();
	await expect
		.element(screen.getByText(/Usunięcie pliku może nie obniżyć użycia od razu/i))
		.toBeVisible();
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('12.5');
	await screen.getByLabelText('Limit R2 (GB)').fill('90.25');
	await screen.getByLabelText('Limit RustFS (GB)').fill('1.25');
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.poll(() => api.updateStorageSettings).toHaveBeenCalledTimes(1);
	expect(api.updateStorageSettings.mock.calls[0]?.[0]).toMatchObject({
		expectedRevision: 3n,
		maxUploadBytes: 12_500_000n,
		r2LimitBytes: 90_250_000_000n,
		rustfsLimitBytes: 1_250_000_000n
	});
});

it('refetches after a revision conflict and does not resubmit over newer settings', async () => {
	api.updateStorageSettings.mockRejectedValueOnce(
		new ConnectError('revision conflict', Code.Aborted)
	);
	const screen = await render(StorageSettingsPage);
	await expect.element(screen.getByRole('heading', { name: 'Ustawienia magazynu' })).toBeVisible();
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent(/zmieniły się w międzyczasie/i);
	await expect.poll(() => api.getStorageSettings).toHaveBeenCalledTimes(2);
	expect(api.updateStorageSettings).toHaveBeenCalledTimes(1);
});

it('allows the zero-byte upload limit supported by the backend', async () => {
	const screen = await render(StorageSettingsPage);
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('0');
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.poll(() => api.updateStorageSettings).toHaveBeenCalledTimes(1);
	expect(api.updateStorageSettings.mock.calls[0]?.[0]).toMatchObject({ maxUploadBytes: 0n });
});

it('allows an administrator to set the multipart maximum of 10 GB', async () => {
	api.getStorageSettings.mockResolvedValue({
		settings: { ...initialSettings, maxUploadBytes: 100_000_000n }
	});
	api.getUploadLimits.mockResolvedValue({
		maxUploadBytes: 100_000_000n,
		canManage: true,
		multipart: {
			enabled: true,
			maxFileBytes: 10_000_000_000n,
			partSizeBytes: 33_554_432n,
			maxParallelParts: 2,
			protocol: 'MULTIPART_V1'
		}
	});
	api.updateStorageSettings.mockResolvedValue({
		settings: { ...initialSettings, maxUploadBytes: 10_000_000_000n, revision: 4n }
	});
	const screen = await render(StorageSettingsPage);
	await expect
		.element(screen.getByText(/10 000 MB.*pojedynczy.*100 MB/i))
		.toBeVisible();
	await expect.element(screen.getByText('Maksymalny rozmiar pliku: 10000 MB.')).toBeVisible();
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('10000');
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.poll(() => api.updateStorageSettings).toHaveBeenCalledTimes(1);
	await expect.poll(() => api.getUploadLimits).toHaveBeenCalledTimes(2);
	expect(api.updateStorageSettings.mock.calls[0]?.[0]).toMatchObject({
		maxUploadBytes: 10_000_000_000n
	});
});

it('rejects an administrator limit above the 10 GB multipart maximum', async () => {
	const screen = await render(StorageSettingsPage);
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('10000.001');
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.element(screen.getByRole('alert')).toHaveTextContent(/obsługiwanym zakresie/i);
	expect(api.updateStorageSettings).not.toHaveBeenCalled();
});

it('identifies an invalid field without falsely warning that it is below usage', async () => {
	const screen = await render(StorageSettingsPage);
	const limit = screen.getByLabelText('Limit R2 (GB)');
	await limit.fill('');
	await expect.element(screen.getByText(/Ustawiony limit jest niższy/)).not.toBeInTheDocument();
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.element(limit).toHaveAttribute('aria-invalid', 'true');
	await expect.element(limit).toHaveAttribute('aria-describedby', expect.stringContaining('r2-limit-error'));
	await expect.element(screen.getByText('Wprowadź limit R2 w dozwolonym zakresie.')).toBeVisible();
	expect(api.updateStorageSettings).not.toHaveBeenCalled();
});

it('keeps byte-precise storage limits when changing only the upload limit', async () => {
	api.getStorageSettings.mockResolvedValue({
		settings: {
			...initialSettings,
			r2LimitBytes: 90_000_000_001n,
			rustfsLimitBytes: 1_000_000_999n
		}
	});
	const screen = await render(StorageSettingsPage);
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('12');
	await screen.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.poll(() => api.updateStorageSettings).toHaveBeenCalledTimes(1);
	expect(api.updateStorageSettings.mock.calls[0]?.[0]).toMatchObject({
		maxUploadBytes: 12_000_000n,
		r2LimitBytes: 90_000_000_001n,
		rustfsLimitBytes: 1_000_000_999n
	});
});

it('shows personal upload preferences without requesting administrator settings for an ordinary account', async () => {
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 25_000_000n, canManage: false });
	const screen = await render(StorageSettingsPage);
	await expect
		.element(screen.getByRole('combobox', { name: 'Domyślne miejsce przechowywania' }))
		.toBeVisible();
	await screen
		.getByRole('combobox', { name: 'Domyślne miejsce przechowywania' })
		.selectOptions('2');
	expect(localStorage.getItem('unisource-cloud:test-user:upload-mode')).toBe('2');
	expect(api.getStorageSettings).not.toHaveBeenCalled();
});
it('preserves an unsaved settings draft across leaving and returning to the page', async () => {
	const screen = await render(StorageSettingsPage);
	await screen.getByLabelText('Maksymalny rozmiar pliku (MB)').fill('17');
	await screen.rerender({ visible: false });
	await screen.rerender({ visible: true });
	await expect.element(screen.getByLabelText('Maksymalny rozmiar pliku (MB)')).toHaveValue('17');
	expect(api.getStorageSettings).toHaveBeenCalledTimes(1);
});
it('loads administration after retrying an initially unavailable upload limit', async () => {
	api.getUploadLimits.mockRejectedValueOnce(new Error('temporarily offline'));
	const screen = await render(StorageSettingsPage);
	await screen.getByRole('button', { name: 'Ponów pobieranie limitu' }).click();
	await expect.element(screen.getByLabelText('Maksymalny rozmiar pliku (MB)')).toBeVisible();
});
