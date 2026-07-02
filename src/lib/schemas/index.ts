import { z } from 'zod';
import { STORAGE } from '$lib/constants';

export const filenameSchema = z
	.string()
	.min(1, 'Filename cannot be empty')
	.max(STORAGE.MAX_FILENAME_LENGTH, 'Filename too long')
	.regex(/^[^\\/\\:*?"<>|]+$/, 'Nieprawidłowe znaki w nazwie pliku');

export const mimeTypeSchema = z.string().regex(/^[\w\-]+\/[\w\-+.]+$/, 'Nieprawidłowy typ MIME');

export const uploadRequestSchema = z.object({
	filename: filenameSchema,
	type: mimeTypeSchema,
	metadata: z.record(z.string(), z.string()).optional()
});

export const fileIdSchema = z.string().min(1, 'ID pliku jest wymagane');
export const folderIdSchema = z.string().min(1, 'ID folderu jest wymagane');
export const userIdSchema = z.string().min(1, 'ID użytkownika jest wymagane');

export const paginationSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0)
});

export const renameSchema = z.object({
	name: z.string().min(1, 'Nazwa jest wymagana').max(255, 'Nazwa jest za długa')
});

export const updateFileSchema = z.object({
	name: z.string().min(1, 'Nazwa jest wymagana').max(255, 'Nazwa jest za długa').optional(),
	parentFolderId: z.string().nullable().optional()
});

export const createFolderSchema = z.object({
	name: z.string().min(1, 'Nazwa folderu jest wymagana').max(255, 'Nazwa folderu jest za długa'),
	parentFolderId: z.string().nullable().optional()
});

export const updateFolderSchema = z.object({
	name: z.string().min(1, 'Nazwa jest wymagana').max(255, 'Nazwa jest za długa').optional(),
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
	.regex(/^[a-zA-Z0-9._-]+$/, 'Nieprawidłowy format tagu');

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
	forceUpdate: z.boolean().optional()
});

export const updateReleaseSchema = z.object({
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).nullable().optional(),
	force_update: z.boolean().optional()
});

// ─── Upload schemas ───────────────────────────────────────────────────────────

export const uploadInitSchema = z.object({
	filename: filenameSchema,
	size: z.number().int().positive('Rozmiar pliku musi być większy od 0'),
	mime_type: mimeTypeSchema,
	is_main_storage: z.boolean().optional(),
	folder_id: z.string().min(1).optional()
});

export const uploadActionSchema = z.object({
	upload_id: z.string().min(1, 'upload_id jest wymagane'),
	is_main_storage: z.boolean().optional()
});

export const multipartPartSchema = z.object({
	PartNumber: z.number().int().min(1).max(10000),
	ETag: z.string().min(1)
});

export const multipartCompleteSchema = z.object({
	upload_id: z.string().min(1, 'upload_id jest wymagane'),
	parts: z.array(multipartPartSchema).min(1, 'parts nie może być puste')
});

export const multipartAbortSchema = z.object({
	upload_id: z.string().min(1, 'upload_id jest wymagane')
});

export const multipartSignPartSchema = z.object({
	upload_id: z.string().min(1, 'upload_id jest wymagane'),
	part_number: z.coerce.number().int().min(1).max(10000)
});

export const multipartListPartsSchema = z.object({
	upload_id: z.string().min(1, 'upload_id jest wymagane')
});
