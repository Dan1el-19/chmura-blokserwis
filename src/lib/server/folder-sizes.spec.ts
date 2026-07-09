import { describe, expect, it } from 'vitest';

import { calculateFolderSizes } from './folder-sizes';

describe('calculateFolderSizes', () => {
	it('adds direct files and all descendant folder contents', () => {
		const sizes = calculateFolderSizes(
			[
				{ id: 'root', parent_id: null },
				{ id: 'child', parent_id: 'root' },
				{ id: 'grandchild', parent_id: 'child' },
				{ id: 'separate', parent_id: null }
			],
			[
				{ folder_id: 'root', size: 10 },
				{ folder_id: 'child', size: 20 },
				{ folder_id: 'grandchild', size: 30 },
				{ folder_id: 'separate', size: 40 },
				{ folder_id: null, size: 50 }
			]
		);

		expect(sizes.get('root')).toBe(60);
		expect(sizes.get('child')).toBe(50);
		expect(sizes.get('grandchild')).toBe(30);
		expect(sizes.get('separate')).toBe(40);
	});
});
