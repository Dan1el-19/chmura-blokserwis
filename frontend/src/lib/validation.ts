import { z } from 'zod';

export const initiateSchema = z.object({
  fileName: z.string().min(1).max(512),
  fileSize: z.number().int().nonnegative().max(10 * 1024 * 1024 * 1024 * 1024), // 10 TB max safeguard
  contentType: z.string().min(1).max(256),
  folder: z.enum(['personal', 'main']).default('personal'),
  subPath: z.string().max(1024).optional().refine(v => !v || !v.includes('..'), 'Invalid path').refine(v => !v || !v.startsWith('/'), 'No leading slash')
});

export const partUrlSchema = z.object({
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000),
  key: z.string().min(1)
});

export const completeSchema = z.object({
  uploadId: z.string().min(1),
  parts: z.array(z.object({
    PartNumber: z.number().int().min(1).max(10000),
    ETag: z.string().min(1)
  })).min(1)
});

export const deleteSchema = z.object({
  key: z.string().min(1)
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(['basic', 'plus', 'admin']).optional(),
  storageLimitGb: z.number().int().positive().max(1024).optional(),
  password: z.string().min(6).max(256).optional()
});

export const adminUpdateUserSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(['basic', 'plus', 'admin']).optional(),
  storageLimit: z.number().int().positive().max(1024 * 1024 * 1024 * 1024).optional() // bytes
});

export const adminPasswordSchema = z.object({
  uid: z.string().min(1),
  password: z.string().min(6).max(256).optional()
});

export const shareSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.number().int().positive().max(30 * 24 * 3600).optional(), // max 30 dni
  expiresAt: z.union([z.string(), z.date()]).optional(),
  name: z.string().max(120).optional()
});

export const downloadSchema = z.object({
  key: z.string().min(1)
});


