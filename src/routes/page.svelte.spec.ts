import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Page from './+page.svelte';

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
});

describe('/+page.svelte', () => {
	it('should render h1', async () => {
		component = mount(Page, {
			target: document.body,
			props: {
				data: {
					user: null,
					recommendedUploadDestination: 'r2' as const,
					files: [],
					folders: [],
					currentFolderId: null,
					fileNextCursor: null,
					folderNextCursor: null,
					role: 'basic',
					storageKind: 'user' as const,
					folderPath: []
				}
			}
		});

		expect(document.querySelector('h1')).not.toBeNull();
	});
});
