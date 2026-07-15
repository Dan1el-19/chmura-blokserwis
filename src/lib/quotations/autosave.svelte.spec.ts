import { describe, expect, it, vi } from 'vitest';
import { QuotationAutosave } from './autosave.svelte';

interface Document {
	title: string;
}

describe('QuotationAutosave', () => {
	it('debounces save and sends the expected lock version', async () => {
		vi.useFakeTimers();
		const save = vi.fn(async (document: Document, expectedLockVersion: number) => ({
			document,
			lockVersion: expectedLockVersion + 1
		}));
		const autosave = new QuotationAutosave({
			initialDocument: { title: 'Początek' },
			initialLockVersion: 4,
			save
		});

		autosave.schedule({ title: 'A' });
		await vi.advanceTimersByTimeAsync(500);
		autosave.schedule({ title: 'B' });
		await vi.advanceTimersByTimeAsync(999);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);

		expect(save).toHaveBeenCalledOnce();
		expect(save).toHaveBeenCalledWith({ title: 'B' }, 4, expect.any(AbortSignal));
		expect(autosave.status).toBe('saved');
		expect(autosave.lockVersion).toBe(5);
		vi.useRealTimers();
	});

	it('serializes edits made during a save and advances expectedLockVersion', async () => {
		vi.useFakeTimers();
		let finishFirst!: (value: { document: Document; lockVersion: number }) => void;
		const save = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishFirst = resolve;
					})
			)
			.mockImplementationOnce(async (document: Document, lockVersion: number) => ({
				document,
				lockVersion: lockVersion + 1
			}));
		const autosave = new QuotationAutosave<Document>({
			initialDocument: { title: '0' },
			initialLockVersion: 1,
			debounceMs: 1_000,
			save
		});

		autosave.schedule({ title: '1' });
		await vi.advanceTimersByTimeAsync(1_000);
		autosave.schedule({ title: '2' });
		finishFirst({ document: { title: '1' }, lockVersion: 2 });
		await Promise.resolve();
		expect(autosave.document).toEqual({ title: '2' });
		await vi.advanceTimersByTimeAsync(1_000);

		expect(save).toHaveBeenNthCalledWith(2, { title: '2' }, 2, expect.any(AbortSignal));
		expect(autosave.document).toEqual({ title: '2' });
		expect(autosave.lockVersion).toBe(3);
		vi.useRealTimers();
	});

	it('never starts a second request when debounce expires during a slow save', async () => {
		vi.useFakeTimers();
		let finishFirst!: (value: { document: Document; lockVersion: number }) => void;
		const save = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishFirst = resolve;
					})
			)
			.mockImplementationOnce(async (document: Document, lockVersion: number) => ({
				document,
				lockVersion: lockVersion + 1
			}));
		const autosave = new QuotationAutosave<Document>({
			initialDocument: { title: '0' },
			initialLockVersion: 1,
			debounceMs: 100,
			save
		});

		autosave.schedule({ title: '1' });
		await vi.advanceTimersByTimeAsync(100);
		autosave.schedule({ title: '2' });
		await vi.advanceTimersByTimeAsync(500);
		expect(save).toHaveBeenCalledOnce();

		finishFirst({ document: { title: '1' }, lockVersion: 2 });
		await vi.advanceTimersByTimeAsync(100);
		expect(save).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenNthCalledWith(2, { title: '2' }, 2, expect.any(AbortSignal));
		vi.useRealTimers();
	});

	it('ignores a late response after replacing the document from server', async () => {
		let finish!: (value: { document: Document; lockVersion: number }) => void;
		const autosave = new QuotationAutosave<Document>({
			initialDocument: { title: '0' },
			initialLockVersion: 1,
			debounceMs: 0,
			save: () =>
				new Promise((resolve) => {
					finish = resolve;
				})
		});
		autosave.schedule({ title: 'lokalna' });
		const pending = autosave.flush();
		await Promise.resolve();
		autosave.replaceFromServer({ title: 'serwer' }, 8);
		finish({ document: { title: 'spóźniona' }, lockVersion: 2 });
		await pending;

		expect(autosave.document).toEqual({ title: 'serwer' });
		expect(autosave.lockVersion).toBe(8);
	});

	it('enters conflict state and requires an explicit resolution', async () => {
		const autosave = new QuotationAutosave<Document>({
			initialDocument: { title: '0' },
			initialLockVersion: 2,
			save: vi
				.fn()
				.mockRejectedValueOnce({
					status: 409,
					code: 'quotation_revision_conflict',
					details: { document: { title: 'serwer' }, lockVersion: 5 }
				})
				.mockResolvedValueOnce({ document: { title: 'lokalna' }, lockVersion: 6 })
		});
		autosave.schedule({ title: 'lokalna' });
		await autosave.flush();

		expect(autosave.status).toBe('conflict');
		expect(autosave.conflict).toMatchObject({
			localDocument: { title: 'lokalna' },
			serverDocument: { title: 'serwer' },
			serverLockVersion: 5
		});

		autosave.resolveWithLocal();
		await autosave.flush();
		expect(autosave.status).toBe('saved');
		expect(autosave.lockVersion).toBe(6);
	});

	it('can resolve a conflict by accepting the server document', async () => {
		const autosave = new QuotationAutosave<Document>({
			initialDocument: { title: '0' },
			initialLockVersion: 1,
			save: vi.fn().mockRejectedValue({ status: 409 })
		});
		autosave.schedule({ title: 'lokalna' });
		await autosave.flush();
		autosave.resolveWithServer({ title: 'serwer' }, 9);

		expect(autosave.status).toBe('saved');
		expect(autosave.document).toEqual({ title: 'serwer' });
		expect(autosave.lockVersion).toBe(9);
	});
});
