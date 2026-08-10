import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReleaseUploadModal from './ReleaseUploadModal.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('ReleaseUploadModal', () => {
	it('emits a valid 64-character certificate pattern in the rendered input', () => {
		component = mount(ReleaseUploadModal, {
			target: document.body,
			props: {
				file: new File(['smoke'], 'blokserwis-2.0.0-beta01.apk', {
					type: 'application/vnd.android.package-archive'
				}),
				onConfirm: vi.fn(),
				onCancel: vi.fn()
			}
		});
		flushSync();

		const certificateInput = document.querySelector<HTMLInputElement>(
			'input[placeholder="64 znaki hex"]'
		);
		expect(certificateInput).not.toBeNull();
		expect(certificateInput?.pattern).toBe('[a-fA-F0-9]{64}');

		certificateInput!.value = '0'.repeat(64);
		expect(certificateInput?.checkValidity()).toBe(true);
	});
});
