import { z } from 'zod';
import { STORAGE } from '$lib/constants';

export const filenameSchema = z
	.string()
	.min(1, 'Filename cannot be empty')
	.max(STORAGE.MAX_FILENAME_LENGTH, 'Filename too long')
	.regex(/^[^\\/\\:*?"<>|]+$/, 'Invalid characters in filename');

export const mimeTypeSchema = z.string().regex(/^[\w\-]+\/[\w\-+.]+$/, 'Invalid MIME type');

export const uploadRequestSchema = z.object({
	filename: filenameSchema,
	type: mimeTypeSchema,
	metadata: z.record(z.string(), z.string()).optional()
});

export const fileIdSchema = z.string().min(1, 'File ID is required');
export const folderIdSchema = z.string().min(1, 'Folder ID is required');
export const userIdSchema = z.string().min(1, 'User ID is required');

export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0)
});

export const renameSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long')
});

export const updateFileSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
	parentFolderId: z.string().nullable().optional()
});

export const createFolderSchema = z.object({
	name: z.string().min(1, 'Folder name is required').max(255, 'Folder name too long'),
	parentFolderId: z.string().nullable().optional()
});

export const updateFolderSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
	parentFolderId: z.string().nullable().optional()
});

export function parseOrError<T>(
	schema: z.ZodType<T>,
	data: unknown
): { data: T } | { error: z.ZodError } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { data: result.data };
	}
	return { error: result.error };
}

// Releases schemas
export const releaseTagSchema = z
	.string()
	.min(1)
	.max(50)
	.regex(/^[a-zA-Z0-9._-]+$/, 'Invalid tag format');

export const releaseFilenameSchema = z
	.string()
	.min(1, 'Filename cannot be empty')
	.max(255, 'Filename too long')
	.regex(/^[\w\-. ]+\.apk$/i, 'Only .apk files are allowed');

export const releaseUploadSchema = z.object({
	filename: releaseFilenameSchema,
	type: z.string(),
	overwrite: z.boolean().optional()
});

export const createReleaseSchema = z.object({
	name: releaseFilenameSchema,
	size: z.number().int().positive(),
	r2Key: z.string().min(1),
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).optional(),
	overwrite: z.boolean().optional(),
	forceUpdate: z.boolean().default(false).optional()
});

export const updateReleaseSchema = z.object({
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).optional()
});
