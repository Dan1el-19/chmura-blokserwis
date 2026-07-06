// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushState, replaceState } from '$app/navigation';
import { closePreviewHistory, openPreviewHistory } from './preview-navigation';

vi.mock('$app/navigation', () => ({
	pushState: vi.fn(),
	replaceState: vi.fn()
}));

describe('openPreviewHistory', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('pushes preview state for user-initiated opens', () => {
		openPreviewHistory('file-1', 'user');

		expect(pushState).toHaveBeenCalledWith('', { previewFileId: 'file-1' });
	});

	it('does not push a duplicate state when restoring from page state', () => {
		openPreviewHistory('file-1', 'history');

		expect(pushState).not.toHaveBeenCalled();
	});
});

describe('closePreviewHistory', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it('goes back when the preview was opened as a shallow history entry', () => {
		const back = vi.spyOn(history, 'back').mockImplementation(() => {});

		closePreviewHistory({ previewFileId: 'file-1' });

		expect(back).toHaveBeenCalledTimes(1);
		expect(replaceState).not.toHaveBeenCalled();
	});

	it('clears current state when there is no preview history entry', () => {
		const back = vi.spyOn(history, 'back').mockImplementation(() => {});

		closePreviewHistory({});

		expect(back).not.toHaveBeenCalled();
		expect(replaceState).toHaveBeenCalledWith('', {});
	});
});
